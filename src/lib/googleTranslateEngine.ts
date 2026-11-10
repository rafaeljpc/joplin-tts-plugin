import { AudioSlot, CreateAudio } from './audioSlot';
import { chunkText } from './chunks';
import { SpeakOptions, TtsEngine, Voice } from './types';

const ENDPOINT = 'https://translate.google.com/translate_tts';
/** The endpoint rejects long texts; sentences above this are split. */
export const MAX_CHARS = 180;

const LANGUAGES: [string, string][] = [
	['ar', 'Arabic'],
	['cs', 'Czech'],
	['da', 'Danish'],
	['de', 'German'],
	['el', 'Greek'],
	['en', 'English'],
	['en-AU', 'English (Australia)'],
	['en-GB', 'English (United Kingdom)'],
	['es', 'Spanish'],
	['es-US', 'Spanish (United States)'],
	['fi', 'Finnish'],
	['fr', 'French'],
	['fr-CA', 'French (Canada)'],
	['he', 'Hebrew'],
	['hi', 'Hindi'],
	['hu', 'Hungarian'],
	['id', 'Indonesian'],
	['it', 'Italian'],
	['ja', 'Japanese'],
	['ko', 'Korean'],
	['nl', 'Dutch'],
	['no', 'Norwegian'],
	['pl', 'Polish'],
	['pt-BR', 'Portuguese (Brazil)'],
	['pt-PT', 'Portuguese (Portugal)'],
	['ro', 'Romanian'],
	['ru', 'Russian'],
	['sv', 'Swedish'],
	['th', 'Thai'],
	['tr', 'Turkish'],
	['uk', 'Ukrainian'],
	['vi', 'Vietnamese'],
	['zh-CN', 'Chinese (Simplified)'],
	['zh-TW', 'Chinese (Traditional)'],
];

export const GOOGLE_TRANSLATE_VOICES: Voice[] = LANGUAGES.map(([code, name]) => ({
	id: code,
	name,
	lang: code,
}));

export interface GoogleTranslateOptions {
	/** Language used when no voice (language) is selected. */
	languageCode: string;
	createAudio: CreateAudio;
}

/**
 * Engine backed by the public Google Translate "listen" endpoint. It needs no
 * key, but it is NOT an official API and may change or stop working. The
 * audio element loads it directly, which avoids CORS. There is one voice per
 * language, so the "voice" is the language code.
 */
export class GoogleTranslateEngine implements TtsEngine {
	private slot: AudioSlot;
	private generation = 0;

	constructor(private options: GoogleTranslateOptions) {
		this.slot = new AudioSlot(options.createAudio);
	}

	async listVoices(): Promise<Voice[]> {
		return GOOGLE_TRANSLATE_VOICES;
	}

	async speak(text: string, { voiceId, rate }: SpeakOptions): Promise<void> {
		const generation = this.generation;
		const language = voiceId || this.options.languageCode;
		for (const chunk of chunkText(text, MAX_CHARS)) {
			if (generation !== this.generation) return;
			const query = `ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(language)}&q=${encodeURIComponent(chunk)}`;
			await this.slot.play(`${ENDPOINT}?${query}`, rate);
		}
	}

	cancel(): void {
		this.generation++;
		this.slot.cancel();
	}
}
