import {
	PanelToPluginMessage,
	PiperSynthesizeReply,
	PiperVoicesReply,
} from '../application/messages';
import { AudioSlot, CreateAudio } from './audioSlot';
import { PrefetchCache } from './prefetchCache';
import { SpeakOptions, TtsEngine, Voice } from '../domain/types';

export interface PiperEngineOptions {
	/** Sends a message to the plugin and resolves with its answer. */
	request: (message: PanelToPluginMessage) => Promise<unknown>;
	createAudio: CreateAudio;
}

/**
 * Offline engine: the plugin synthesizes each sentence with a downloaded Piper
 * voice and returns it as a WAV file; the panel only plays it.
 */
export class PiperEngine implements TtsEngine {
	private slot: AudioSlot;
	private generation = 0;
	private cache = new PrefetchCache<string>();

	constructor(private options: PiperEngineOptions) {
		this.slot = new AudioSlot(options.createAudio);
	}

	async listVoices(): Promise<Voice[]> {
		const reply = (await this.options.request({ type: 'piperVoices' })) as PiperVoicesReply | null;
		return reply?.voices ?? [];
	}

	async speak(text: string, { voiceId, rate }: SpeakOptions): Promise<void> {
		const generation = this.generation;
		const wav = await this.cache.take(`${voiceId}|${text}`, () => this.synthesize(text, voiceId));
		// A cancel that arrived while the sentence was being synthesized must win.
		if (generation !== this.generation) return;
		await this.slot.play(`data:audio/wav;base64,${wav}`, rate);
	}

	prefetch(text: string, { voiceId }: SpeakOptions): void {
		this.cache.prefetch(`${voiceId}|${text}`, () => this.synthesize(text, voiceId));
	}

	cancel(): void {
		this.generation++;
		this.slot.cancel();
	}

	private async synthesize(text: string, voiceId: string): Promise<string> {
		const reply = (await this.options.request({
			type: 'piperSynthesize',
			text,
			voiceId,
		})) as PiperSynthesizeReply | null;
		if (!reply?.ok) throw new Error(reply?.error ?? 'Piper could not speak this sentence');
		return reply.wav;
	}
}
