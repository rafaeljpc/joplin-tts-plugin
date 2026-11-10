import { SpeakOptions, TtsEngine, Voice } from './types';

const BASE_URL = 'https://texttospeech.googleapis.com/v1';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface AudioLike {
	playbackRate: number;
	preservesPitch?: boolean;
	onended: HTMLMediaElement['onended'];
	onerror: HTMLMediaElement['onerror'];
	play(): Promise<void> | void;
	pause(): void;
}

export interface GoogleCloudOptions {
	apiKey: string;
	languageCode: string;
	fetchFn: FetchFn;
	createAudio: (src: string) => AudioLike;
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
	private current: AudioLike | null = null;
	private cancelCurrent: (() => void) | null = null;

	constructor(private options: GoogleCloudOptions) {}

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
		const { apiKey, languageCode, fetchFn, createAudio } = this.options;
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
		if (!data.audioContent) throw new Error('Google TTS returned no audio');

		// A cancel that arrived while the request was in flight must win.
		return new Promise<void>((resolve, reject) => {
			const audio = createAudio(`data:audio/mp3;base64,${data.audioContent}`);
			audio.playbackRate = rate;
			audio.preservesPitch = true;
			audio.onended = () => this.finish(audio, resolve);
			audio.onerror = () => this.finish(audio, () => reject(new Error('Audio playback failed')));
			this.current = audio;
			this.cancelCurrent = () => this.finish(audio, resolve);
			Promise.resolve(audio.play()).catch((e: unknown) =>
				this.finish(audio, () => reject(e instanceof Error ? e : new Error(String(e)))),
			);
		});
	}

	cancel(): void {
		this.cancelCurrent?.();
	}

	private finish(audio: AudioLike, done: () => void): void {
		if (this.current !== audio) return;
		this.current = null;
		this.cancelCurrent = null;
		audio.onended = null;
		audio.onerror = null;
		audio.pause();
		done();
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
