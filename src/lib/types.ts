export type EngineId = 'webspeech' | 'google-translate' | 'google-cloud' | 'azure';

export interface Voice {
	/** Stable identifier (voiceURI for Web Speech, voice name for Google). */
	id: string;
	name: string;
	lang: string;
}

export interface SpeakOptions {
	voiceId: string;
	rate: number;
}

/**
 * A speech engine speaks ONE sentence at a time. The promise resolves when the
 * sentence ends (or is cancelled) and rejects on a real failure.
 */
export interface TtsEngine {
	listVoices(): Promise<Voice[]>;
	speak(text: string, options: SpeakOptions): Promise<void>;
	cancel(): void;
}

export interface Settings {
	engine: EngineId;
	voice: string;
	rate: number;
	googleApiKey: string;
	azureApiKey: string;
	azureRegion: string;
	/** Language code (e.g. pt-BR) used by the online engines. */
	language: string;
	readTitle: boolean;
}

/** Messages sent from the plugin (main process) to the panel webview. */
export type PluginToPanelMessage =
	| { type: 'init'; settings: Settings }
	| { type: 'settings'; settings: Settings }
	| {
			type: 'load';
			title: string;
			sentences: string[];
			/** Sentence where reading starts (the one at the editor cursor). */
			startIndex: number;
			autoplay: boolean;
	  }
	| { type: 'stop' };

/** Messages sent from the panel webview to the plugin. */
export type PanelToPluginMessage =
	| { type: 'ready' }
	| { type: 'reload' }
	| { type: 'saveSettings'; patch: Partial<Settings> }
	| { type: 'close' };
