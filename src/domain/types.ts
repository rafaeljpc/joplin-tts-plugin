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
