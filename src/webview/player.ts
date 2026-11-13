import { buildEngine, EngineEnv } from './engines';
import { getStrings, Strings } from './i18n';
import { createView, PlayerView } from './playerView';
import { PlayerController } from '../application/player';
import { DEFAULT_SETTINGS } from '../domain/settings';
import { PanelToPluginMessage, PluginToPanelMessage } from '../application/messages';
import { Settings, TtsEngine, Voice } from '../domain/types';

export interface WebviewApiLike {
	postMessage(message: PanelToPluginMessage): Promise<unknown>;
	onMessage(callback: (message: unknown) => void): void;
}

export interface WebviewScope {
	speechSynthesis?: SpeechSynthesis;
	SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
	fetch: typeof fetch;
	Audio: typeof Audio;
	URL: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void };
	navigator: { language?: string };
}

export const RATE_CHOICES = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/** Builds the engine for `settings`; the engines themselves are registered in `engines.ts`. */
export function createEngine(
	settings: Settings,
	scope: WebviewScope,
	t: Strings,
	/** Sends a message to the plugin and resolves with its answer (needed by Piper). */
	request?: (message: PanelToPluginMessage) => Promise<unknown>,
): TtsEngine {
	return buildEngine(settings, { scope, t, request });
}

export function unwrapMessage(raw: unknown): PluginToPanelMessage | null {
	const candidate = (raw as { message?: unknown } | null)?.message ?? raw;
	const type = (candidate as { type?: unknown } | null)?.type;
	return typeof type === 'string' ? (candidate as PluginToPanelMessage) : null;
}

/** The settings of the panel and what depends on them (engine, voices, rate). */
function createSettingsManager(controller: PlayerController, view: PlayerView, env: EngineEnv) {
	let settings: Settings = { ...DEFAULT_SETTINGS };
	// Ids of the voices of the current engine; null when listing failed.
	let voiceIds: Set<string> | null = null;

	const fillRates = () => {
		const rates = RATE_CHOICES.includes(settings.rate)
			? RATE_CHOICES
			: [...RATE_CHOICES, settings.rate].sort((a, b) => a - b);
		view.setRates(rates, settings.rate);
	};

	const fillVoices = async () => {
		let voices: Voice[] = [];
		voiceIds = null;
		try {
			voices = await controller.listVoices();
			voiceIds = new Set(voices.map((v) => v.id));
		} catch (error) {
			view.showError(error instanceof Error ? error.message : String(error));
		}
		// An empty list is not fatal (the default voice may still work) but is the usual
		// sign of an Android WebView without a speech engine: say so and name the way out.
		if (voiceIds && voices.length === 0 && settings.engine === 'webspeech') {
			view.showError(env.t.webspeechNoVoices);
		}
		view.setVoices(voices, settings.voice);
	};

	// Only these settings require a new engine (and a new voice list).
	const engineSignature = (c: Settings) =>
		JSON.stringify([c.engine, c.googleApiKey, c.azureApiKey, c.azureRegion, c.language]);

	return {
		get: () => settings,
		/** Applies settings coming from the plugin. */
		async apply(next: Settings, first: boolean) {
			const replaceEngine = first || engineSignature(next) !== engineSignature(settings);
			settings = next;
			if (replaceEngine) {
				controller.setEngine(buildEngine(settings, env));
				view.showError(null);
				await fillVoices();
			}
			controller.setRate(settings.rate);
			// A voice saved for another engine is unknown here: fall back to the default.
			controller.setVoice(voiceIds && !voiceIds.has(settings.voice) ? '' : settings.voice);
			fillRates();
		},
		/** Lists the voices again (after voices were downloaded or removed) and keeps the selected one. */
		async refreshVoices() {
			await fillVoices();
			controller.setVoice(voiceIds && !voiceIds.has(settings.voice) ? '' : settings.voice);
		},
		/** Applies a change made by the user in the panel. */
		change(patch: Partial<Pick<Settings, 'rate' | 'voice'>>) {
			settings = { ...settings, ...patch };
		},
	};
}

export function initPlayer(doc: Document, api: WebviewApiLike, scope: WebviewScope) {
	const t = getStrings(scope.navigator.language);
	const root = doc.getElementById('tts-root');
	if (!root) throw new Error('Missing #tts-root element');

	const request = (message: PanelToPluginMessage) => api.postMessage(message);
	const env: EngineEnv = { scope, t, request };
	const controller = new PlayerController(buildEngine({ ...DEFAULT_SETTINGS }, env));
	let title = '';

	const save = (patch: Partial<Settings>) => void api.postMessage({ type: 'saveSettings', patch });

	const view: PlayerView = createView(doc, root, t, {
		onClose() {
			controller.stop();
			void api.postMessage({ type: 'close' });
		},
		onPlay() {
			view.showError(null);
			// Starting from idle asks the plugin for a fresh plan, so reading begins at
			// the editor cursor or the current selection. Resume/pause act locally.
			if (controller.getState().status === 'idle')
				void api.postMessage({ type: 'reload', autoplay: true });
			else controller.toggle();
		},
		onPrevious: () => controller.previous(),
		onNext: () => controller.next(),
		onStop: () => controller.stop(),
		onRate(rate) {
			settingsManager.change({ rate });
			controller.setRate(rate);
			save({ rate });
		},
		onVoice(voice) {
			settingsManager.change({ voice });
			controller.setVoice(voice);
			save({ voice });
		},
	});
	const settingsManager = createSettingsManager(controller, view, env);

	const handleMessage = (message: PluginToPanelMessage) => {
		switch (message.type) {
			case 'init':
				view.setMobile(message.mobile === true);
				void settingsManager.apply(message.settings, true);
				break;
			case 'settings':
				void settingsManager.apply(message.settings, false);
				break;
			case 'load':
				title = message.title;
				view.showError(null);
				controller.load(message.sentences, message.startIndex);
				if (message.autoplay) controller.play();
				break;
			case 'stop':
				controller.stop();
				break;
			case 'voices':
				void settingsManager.refreshVoices();
				break;
		}
	};

	api.onMessage((raw) => {
		const message = unwrapMessage(raw);
		if (message) handleMessage(message);
	});
	// Tell the plugin which sentence is current so it can be highlighted in the note.
	let reportedIndex: number | null = null;
	controller.onChange((state) => {
		view.render(state, title);
		const index = state.status === 'idle' ? null : state.index;
		if (index === reportedIndex) return;
		reportedIndex = index;
		void api.postMessage({ type: 'progress', index });
	});
	controller.onError((error) => view.showError(error.message));
	view.render(controller.getState(), title);
	void api.postMessage({ type: 'ready' });

	return { getController: () => controller, getSettings: settingsManager.get };
}

/** Auto-start inside the Joplin panel webview. */
declare const webviewApi: WebviewApiLike | undefined;
if (typeof webviewApi !== 'undefined' && typeof document !== 'undefined') {
	const start = () => initPlayer(document, webviewApi, window as unknown as WebviewScope);
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();
}
