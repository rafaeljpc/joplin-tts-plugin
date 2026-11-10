import { AudioSlot, CreateAudio } from './audioSlot';
import { SpeakOptions, TtsEngine, Voice } from '../domain/types';

export type { AudioLike } from './audioSlot';

const BASE_URL = 'https://texttospeech.googleapis.com/v1';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface GoogleCloudOptions {
	apiKey: string;
	languageCode: string;
	fetchFn: FetchFn;
	createAudio: CreateAudio;
}

interface GoogleVoice {
	name: string;
	languageCodes: string[];
}

/**
 * Engine backed by Google Cloud Text-to-Speech (user-provided API key).
 * Audio is played through an <audio> element, speed via `playbackRate`.
 */
export class GoogleCloudEngine implements TtsEngine {
	private slot: AudioSlot;
	private generation = 0;

	constructor(private options: GoogleCloudOptions) {
		this.slot = new AudioSlot(options.createAudio);
	}

	async listVoices(): Promise<Voice[]> {
		const { apiKey, languageCode, fetchFn } = this.options;
		const url = `${BASE_URL}/voices?languageCode=${encodeURIComponent(languageCode)}&key=${encodeURIComponent(apiKey)}`;
		const response = await fetchFn(url);
		const data = await this.parse<{ voices?: GoogleVoice[] }>(response);
		return (data.voices ?? []).map((v) => ({
			id: v.name,
			name: v.name,
			lang: v.languageCodes[0] ?? languageCode,
		}));
	}

	async speak(text: string, { voiceId, rate }: SpeakOptions): Promise<void> {
		const { apiKey, languageCode, fetchFn } = this.options;
		const generation = this.generation;
		const body = {
			input: { text },
			voice: voiceId ? { languageCode, name: voiceId } : { languageCode },
			audioConfig: { audioEncoding: 'MP3' },
		};
		const response = await fetchFn(
			`${BASE_URL}/text:synthesize?key=${encodeURIComponent(apiKey)}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			},
		);
		const data = await this.parse<{ audioContent?: string }>(response);
		// A cancel that arrived while the request was in flight must win.
		if (generation !== this.generation) return;
		if (!data.audioContent) throw new Error('Google TTS returned no audio');
		await this.slot.play(`data:audio/mp3;base64,${data.audioContent}`, rate);
	}

	cancel(): void {
		this.generation++;
		this.slot.cancel();
	}

	private async parse<T>(response: Response): Promise<T> {
		if (!response.ok) {
			let detail = '';
			try {
				const data = (await response.json()) as { error?: { message?: string } };
				detail = data.error?.message ?? '';
			} catch {
				// Non-JSON error body: fall back to the status text.
			}
			throw new Error(`Google TTS error ${response.status}${detail ? `: ${detail}` : ''}`);
		}
		return (await response.json()) as T;
	}
}
