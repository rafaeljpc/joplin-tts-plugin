export type EngineId = 'webspeech' | 'google-translate' | 'google-cloud' | 'azure' | 'piper';

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
	/**
	 * Optional hint: `text` will be spoken next, so online engines can fetch its
	 * audio now and avoid a gap between sentences. Must never throw or reject.
	 */
	prefetch?(text: string, options: SpeakOptions): void;
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
	/** Where the Piper voices are downloaded from (see piperCatalog.ts). */
	piperCatalogUrl: string;
}
