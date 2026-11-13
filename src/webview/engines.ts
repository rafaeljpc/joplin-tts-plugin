import { AzureSpeechEngine } from '../adapters/azureEngine';
import { GoogleCloudEngine } from '../adapters/googleCloudEngine';
import { GoogleTranslateEngine } from '../adapters/googleTranslateEngine';
import { PiperEngine } from '../adapters/piperEngine';
import { WebSpeechEngine } from '../adapters/webSpeechEngine';
import { PanelToPluginMessage } from '../application/messages';
import { EngineId, Settings, TtsEngine, Voice } from '../domain/types';
import { Strings } from './i18n';

/** The browser features of the panel the engines are built on. */
export interface EngineScope {
	speechSynthesis?: SpeechSynthesis;
	SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
	fetch: typeof fetch;
	Audio: typeof Audio;
	URL: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void };
}

/** Everything an engine factory may need; built once by the panel's composition root. */
export interface EngineEnv {
	scope: EngineScope;
	t: Strings;
	/** Sends a message to the plugin and resolves with its answer (needed by Piper). */
	request?: (message: PanelToPluginMessage) => Promise<unknown>;
}

/** Builds the engine for the given settings; each engine has one factory. */
export type EngineFactory = (settings: Settings, env: EngineEnv) => TtsEngine;

/** Engine used when the selected engine cannot work; every call explains why. */
export class UnavailableEngine implements TtsEngine {
	constructor(private reason: string) {}
	async listVoices(): Promise<Voice[]> {
		return [];
	}
	speak(): Promise<void> {
		return Promise.reject(new Error(this.reason));
	}
	cancel(): void {}
}

const fetchOf = (env: EngineEnv) => (url: string, init?: RequestInit) => env.scope.fetch(url, init);
const audioOf = (env: EngineEnv) => (src?: string) => new env.scope.Audio(src);

/** One factory per engine: a new engine is added here, without touching the others. */
export const ENGINE_FACTORIES: Record<EngineId, EngineFactory> = {
	webspeech: (_settings, { scope, t }) => {
		if (!scope.speechSynthesis || !scope.SpeechSynthesisUtterance) {
			return new UnavailableEngine(t.unsupported);
		}
		return new WebSpeechEngine(scope.speechSynthesis, scope.SpeechSynthesisUtterance, {
			noStart: t.webspeechNoStart,
		});
	},
	'google-translate': (settings, env) =>
		new GoogleTranslateEngine({ languageCode: settings.language, createAudio: audioOf(env) }),
	'google-cloud': (settings, env) =>
		settings.googleApiKey
			? new GoogleCloudEngine({
					apiKey: settings.googleApiKey,
					languageCode: settings.language,
					fetchFn: fetchOf(env),
					createAudio: audioOf(env),
				})
			: new UnavailableEngine(env.t.missingGoogleKey),
	azure: (settings, env) =>
		settings.azureApiKey
			? new AzureSpeechEngine({
					apiKey: settings.azureApiKey,
					region: settings.azureRegion,
					languageCode: settings.language,
					fetchFn: fetchOf(env),
					createAudio: audioOf(env),
					createObjectUrl: (blob) => env.scope.URL.createObjectURL(blob),
					revokeObjectUrl: (url) => env.scope.URL.revokeObjectURL(url),
				})
			: new UnavailableEngine(env.t.missingAzureKey),
	piper: (_settings, env) =>
		env.request
			? new PiperEngine({ request: env.request, createAudio: audioOf(env) })
			: new UnavailableEngine(env.t.unsupported),
};

export function buildEngine(settings: Settings, env: EngineEnv): TtsEngine {
	return ENGINE_FACTORIES[settings.engine](settings, env);
}
