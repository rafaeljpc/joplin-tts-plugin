import { AudioSlot, CreateAudio } from './audioSlot';
import { SpeakOptions, TtsEngine, Voice } from './types';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface AzureOptions {
	apiKey: string;
	/** Azure region of the Speech resource, e.g. `eastus` or `brazilsouth`. */
	region: string;
	languageCode: string;
	fetchFn: FetchFn;
	createAudio: CreateAudio;
	createObjectUrl: (blob: Blob) => string;
	revokeObjectUrl: (url: string) => void;
}

interface AzureVoice {
	ShortName: string;
	LocalName?: string;
	DisplayName?: string;
	Locale: string;
	Gender?: string;
}

const escapeXml = (text: string): string =>
	text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Engine backed by the official Azure AI Speech REST API (Microsoft neural
 * voices). The user supplies a Speech resource key and region; the free tier
 * covers 500,000 characters per month.
 */
export class AzureSpeechEngine implements TtsEngine {
	private slot: AudioSlot;
	private generation = 0;
	private voices: Promise<Voice[]> | null = null;

	constructor(private options: AzureOptions) {
		this.slot = new AudioSlot(options.createAudio);
	}

	private get baseUrl(): string {
		return `https://${encodeURIComponent(this.options.region)}.tts.speech.microsoft.com/cognitiveservices`;
	}

	listVoices(): Promise<Voice[]> {
		this.voices ??= this.fetchVoices().catch((error: unknown) => {
			this.voices = null; // do not cache failures
			throw error;
		});
		return this.voices;
	}

	async speak(text: string, { voiceId, rate }: SpeakOptions): Promise<void> {
		const generation = this.generation;
		const voice = voiceId || (await this.defaultVoice());
		const locale = /^([a-z]{2,3}-[A-Za-z0-9]+)-/.exec(voice)?.[1] ?? this.options.languageCode;
		const ssml = `<speak version='1.0' xml:lang='${escapeXml(locale)}'><voice name='${escapeXml(voice)}'>${escapeXml(text)}</voice></speak>`;
		const response = await this.options.fetchFn(`${this.baseUrl}/v1`, {
			method: 'POST',
			headers: {
				'Ocp-Apim-Subscription-Key': this.options.apiKey,
				'Content-Type': 'application/ssml+xml',
				'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
			},
			body: ssml,
		});
		if (!response.ok) throw new Error(`Azure TTS error ${response.status}`);
		const blob = await response.blob();
		// A cancel that arrived while the request was in flight must win.
		if (generation !== this.generation) return;
		const url = this.options.createObjectUrl(blob);
		try {
			await this.slot.play(url, rate);
		} finally {
			this.options.revokeObjectUrl(url);
		}
	}

	cancel(): void {
		this.generation++;
		this.slot.cancel();
	}

	private async fetchVoices(): Promise<Voice[]> {
		const response = await this.options.fetchFn(`${this.baseUrl}/voices/list`, {
			headers: { 'Ocp-Apim-Subscription-Key': this.options.apiKey },
		});
		if (!response.ok) throw new Error(`Azure TTS error ${response.status}`);
		const all = (await response.json()) as AzureVoice[];
		const language = this.options.languageCode.split('-')[0].toLowerCase();
		return all
			.filter((v) => v.Locale.split('-')[0].toLowerCase() === language)
			.map((v) => ({
				id: v.ShortName,
				name: `${v.LocalName ?? v.DisplayName ?? v.ShortName}${v.Gender ? ` (${v.Gender})` : ''}`,
				lang: v.Locale,
			}));
	}

	/** First voice of the exact locale, else of the language. */
	private async defaultVoice(): Promise<string> {
		const voices = await this.listVoices();
		const voice =
			voices.find((v) => v.lang.toLowerCase() === this.options.languageCode.toLowerCase()) ??
			voices[0];
		if (!voice) throw new Error(`No Azure voice available for ${this.options.languageCode}`);
		return voice.id;
	}
}
