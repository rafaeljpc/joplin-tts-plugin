import { AzureSpeechEngine } from '../lib/azureEngine';
import { GoogleCloudEngine } from '../lib/googleCloudEngine';
import { GoogleTranslateEngine } from '../lib/googleTranslateEngine';
import { format, getStrings, Strings } from '../lib/i18n';
import { PlayerController, PlayerState } from '../lib/player';
import { DEFAULT_SETTINGS } from '../lib/settings';
import {
	PanelToPluginMessage,
	PluginToPanelMessage,
	Settings,
	TtsEngine,
	Voice,
} from '../lib/types';
import { WebSpeechEngine } from '../lib/webSpeechEngine';

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

export const RATE_CHOICES = [0.75, 1, 1.25, 1.5, 2];

/** Engine used when the selected engine cannot work; every call explains why. */
class UnavailableEngine implements TtsEngine {
	constructor(private reason: string) {}
	async listVoices(): Promise<Voice[]> {
		return [];
	}
	speak(): Promise<void> {
		return Promise.reject(new Error(this.reason));
	}
	cancel(): void {}
}

export function createEngine(settings: Settings, scope: WebviewScope, t: Strings): TtsEngine {
	const fetchFn = (url: string, init?: RequestInit) => scope.fetch(url, init);
	const createAudio = (src: string) => new scope.Audio(src);
	switch (settings.engine) {
		case 'google-cloud':
			if (!settings.googleApiKey) return new UnavailableEngine(t.missingGoogleKey);
			return new GoogleCloudEngine({
				apiKey: settings.googleApiKey,
				languageCode: settings.language,
				fetchFn,
				createAudio,
			});
		case 'azure':
			if (!settings.azureApiKey) return new UnavailableEngine(t.missingAzureKey);
			return new AzureSpeechEngine({
				apiKey: settings.azureApiKey,
				region: settings.azureRegion,
				languageCode: settings.language,
				fetchFn,
				createAudio,
				createObjectUrl: (blob) => scope.URL.createObjectURL(blob),
				revokeObjectUrl: (url) => scope.URL.revokeObjectURL(url),
			});
		case 'google-translate':
			return new GoogleTranslateEngine({ languageCode: settings.language, createAudio });
		default:
			if (!scope.speechSynthesis || !scope.SpeechSynthesisUtterance) {
				return new UnavailableEngine(t.unsupported);
			}
			return new WebSpeechEngine(scope.speechSynthesis, scope.SpeechSynthesisUtterance);
	}
}

/** Joplin may deliver the payload directly or wrapped as `{ message }`. */
export function unwrapMessage(raw: unknown): PluginToPanelMessage | null {
	const candidate = (raw as { message?: unknown } | null)?.message ?? raw;
	const type = (candidate as { type?: unknown } | null)?.type;
	return typeof type === 'string' ? (candidate as PluginToPanelMessage) : null;
}

function el<K extends keyof HTMLElementTagNameMap>(
	doc: Document,
	tag: K,
	props: Partial<HTMLElementTagNameMap[K]> & { className?: string },
	children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
	const node = doc.createElement(tag);
	Object.assign(node, props);
	node.append(...children);
	return node;
}

export function initPlayer(doc: Document, api: WebviewApiLike, scope: WebviewScope) {
	const t = getStrings(scope.navigator.language);
	const root = doc.getElementById('tts-root');
	if (!root) throw new Error('Missing #tts-root element');

	let settings: Settings = { ...DEFAULT_SETTINGS };
	const controller = new PlayerController(createEngine(settings, scope, t));
	let title = '';

	// --- UI -------------------------------------------------------------
	const titleEl = el(doc, 'div', { className: 'tts-title' });
	const closeBtn = el(doc, 'button', { className: 'tts-close', title: t.close, textContent: '×' });
	const sentenceEl = el(doc, 'div', { className: 'tts-sentence', textContent: t.ready });
	const errorEl = el(doc, 'div', { className: 'tts-error', hidden: true });
	const prevBtn = el(doc, 'button', { className: 'tts-prev', title: t.previous, textContent: '⏮' });
	const playBtn = el(doc, 'button', { className: 'tts-play', title: t.play, textContent: '▶' });
	const nextBtn = el(doc, 'button', { className: 'tts-next', title: t.next, textContent: '⏭' });
	const stopBtn = el(doc, 'button', { className: 'tts-stop', title: t.stop, textContent: '⏹' });
	const voiceSelect = el(doc, 'select', { className: 'tts-voice', title: t.voice });
	const rateSelect = el(doc, 'select', { className: 'tts-rate', title: t.speed });
	const progress = el(doc, 'progress', { className: 'tts-progress', max: 1, value: 0 });
	const counter = el(doc, 'div', { className: 'tts-counter' });

	root.replaceChildren(
		el(doc, 'div', { className: 'tts-header' }, [titleEl, closeBtn]),
		sentenceEl,
		errorEl,
		progress,
		counter,
		el(doc, 'div', { className: 'tts-controls' }, [prevBtn, playBtn, nextBtn, stopBtn]),
		el(doc, 'div', { className: 'tts-options' }, [voiceSelect, rateSelect]),
	);

	const showError = (message: string | null) => {
		errorEl.hidden = message === null;
		errorEl.textContent = message === null ? '' : t.errorPrefix + message;
	};

	const render = (state: PlayerState) => {
		const playing = state.status === 'playing';
		playBtn.textContent = playing ? '⏸' : '▶';
		playBtn.title = playing ? t.pause : t.play;
		titleEl.textContent = title || t.title;
		if (state.total === 0) {
			sentenceEl.textContent = title ? t.empty : t.ready;
			counter.textContent = '';
			progress.value = 0;
		} else {
			sentenceEl.textContent = state.sentence;
			counter.textContent = format(t.sentenceOf, state.index + 1, state.total);
			progress.value = (state.index + 1) / state.total;
		}
		playBtn.disabled = state.total === 0;
		prevBtn.disabled = stopBtn.disabled = nextBtn.disabled = state.total === 0;
	};

	const fillRates = () => {
		const rates = RATE_CHOICES.includes(settings.rate)
			? RATE_CHOICES
			: [...RATE_CHOICES, settings.rate].sort((a, b) => a - b);
		rateSelect.replaceChildren(
			...rates.map((r) =>
				el(doc, 'option', {
					value: String(r),
					textContent: `${r}×`,
					selected: r === settings.rate,
				}),
			),
		);
	};

	// Ids of the voices of the current engine; null when listing failed.
	let voiceIds: Set<string> | null = null;

	const fillVoices = async () => {
		let voices: Voice[] = [];
		voiceIds = null;
		try {
			voices = await controller.listVoices();
			voiceIds = new Set(voices.map((v) => v.id));
		} catch (error) {
			showError(error instanceof Error ? error.message : String(error));
		}
		voices.sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
		voiceSelect.replaceChildren(
			el(doc, 'option', { value: '', textContent: t.defaultVoice }),
			...voices.map((v) =>
				el(doc, 'option', {
					value: v.id,
					textContent: `${v.name} (${v.lang})`,
					selected: v.id === settings.voice,
				}),
			),
		);
	};

	// --- Settings -------------------------------------------------------
	const engineSignature = (c: Settings) =>
		JSON.stringify([c.engine, c.googleApiKey, c.azureApiKey, c.azureRegion, c.language]);

	const applySettings = async (next: Settings, first: boolean) => {
		const replaceEngine = first || engineSignature(next) !== engineSignature(settings);
		settings = next;
		if (replaceEngine) {
			controller.setEngine(createEngine(settings, scope, t));
			showError(null);
			await fillVoices();
		}
		controller.setRate(settings.rate);
		// A voice saved for another engine is unknown here: fall back to the default.
		controller.setVoice(voiceIds && !voiceIds.has(settings.voice) ? '' : settings.voice);
		fillRates();
	};

	// --- Events ---------------------------------------------------------
	closeBtn.onclick = () => {
		controller.stop();
		void api.postMessage({ type: 'close' });
	};
	playBtn.onclick = () => {
		showError(null);
		// Starting from idle asks the plugin for a fresh plan, so reading begins at
		// the editor cursor or the current selection. Resume/pause act locally.
		if (controller.getState().status === 'idle')
			void api.postMessage({ type: 'reload', autoplay: true });
		else controller.toggle();
	};
	prevBtn.onclick = () => controller.previous();
	nextBtn.onclick = () => controller.next();
	stopBtn.onclick = () => controller.stop();
	rateSelect.onchange = () => {
		const rate = Number(rateSelect.value);
		settings = { ...settings, rate };
		controller.setRate(rate);
		void api.postMessage({ type: 'saveSettings', patch: { rate } });
	};
	voiceSelect.onchange = () => {
		const voice = voiceSelect.value;
		settings = { ...settings, voice };
		controller.setVoice(voice);
		void api.postMessage({ type: 'saveSettings', patch: { voice } });
	};

	api.onMessage((raw) => {
		const message = unwrapMessage(raw);
		if (!message) return;
		switch (message.type) {
			case 'init':
				void applySettings(message.settings, true);
				break;
			case 'settings':
				void applySettings(message.settings, false);
				break;
			case 'load':
				title = message.title;
				showError(null);
				controller.load(message.sentences, message.startIndex);
				if (message.autoplay) controller.play();
				break;
			case 'stop':
				controller.stop();
				break;
		}
	});

	controller.onChange(render);
	controller.onError((error) => showError(error.message));
	render(controller.getState());
	void api.postMessage({ type: 'ready' });

	return { getController: () => controller, getSettings: () => settings };
}

/** Auto-start inside the Joplin panel webview. */
declare const webviewApi: WebviewApiLike | undefined;
if (typeof webviewApi !== 'undefined' && typeof document !== 'undefined') {
	const start = () => initPlayer(document, webviewApi, window as unknown as WebviewScope);
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();
}
