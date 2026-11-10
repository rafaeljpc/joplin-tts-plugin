import { TtsEngine, Voice } from './types';

export type PlayerStatus = 'idle' | 'playing' | 'paused';

export interface PlayerState {
	status: PlayerStatus;
	index: number;
	total: number;
	sentence: string;
}

type Listener = (state: PlayerState) => void;
type ErrorListener = (error: Error) => void;

/**
 * Sentence-by-sentence player. It is engine-agnostic and holds no DOM or
 * Joplin dependency, which makes it fully unit-testable.
 *
 * Pause semantics: the engine cancels the current sentence and `resume`
 * re-speaks it from the start. This is reliable across engines, because
 * `speechSynthesis.pause()` is known to misbehave on some platforms.
 */
export class PlayerController {
	private sentences: string[] = [];
	private index = 0;
	private status: PlayerStatus = 'idle';
	private generation = 0;
	private voiceId = '';
	private rate = 1;
	private listeners = new Set<Listener>();
	private errorListeners = new Set<ErrorListener>();

	constructor(private engine: TtsEngine) {}

	getState(): PlayerState {
		return {
			status: this.status,
			index: this.index,
			total: this.sentences.length,
			sentence: this.sentences[this.index] ?? '',
		};
	}

	onChange(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	onError(listener: ErrorListener): () => void {
		this.errorListeners.add(listener);
		return () => this.errorListeners.delete(listener);
	}

	listVoices(): Promise<Voice[]> {
		return this.engine.listVoices();
	}

	setEngine(engine: TtsEngine): void {
		this.halt();
		this.engine = engine;
		this.status = this.status === 'playing' ? 'paused' : this.status;
		this.emit();
	}

	load(sentences: string[], startIndex = 0): void {
		this.halt();
		this.sentences = [...sentences];
		this.index = Math.min(Math.max(0, startIndex), Math.max(0, sentences.length - 1));
		this.status = 'idle';
		this.emit();
	}

	play(): void {
		if (this.sentences.length === 0 || this.status === 'playing') return;
		this.status = 'playing';
		this.speakCurrent();
		this.emit();
	}

	pause(): void {
		if (this.status !== 'playing') return;
		this.halt();
		this.status = 'paused';
		this.emit();
	}

	toggle(): void {
		if (this.status === 'playing') this.pause();
		else this.play();
	}

	stop(): void {
		this.halt();
		this.index = 0;
		this.status = 'idle';
		this.emit();
	}

	next(): void {
		this.seek(this.index + 1);
	}

	previous(): void {
		this.seek(this.index - 1);
	}

	/** Jumps to a sentence. Keeps playing if it was playing. */
	seek(index: number): void {
		if (this.sentences.length === 0) return;
		const target = Math.min(this.sentences.length - 1, Math.max(0, index));
		this.halt();
		this.index = target;
		if (this.status === 'playing') this.speakCurrent();
		this.emit();
	}

	setRate(rate: number): void {
		this.rate = rate;
		this.restartIfPlaying();
	}

	setVoice(voiceId: string): void {
		this.voiceId = voiceId;
		this.restartIfPlaying();
	}

	private restartIfPlaying(): void {
		if (this.status !== 'playing') return;
		this.halt();
		this.speakCurrent();
	}

	/** Invalidates any in-flight sentence and silences the engine. */
	private halt(): void {
		this.generation++;
		this.engine.cancel();
	}

	private speakCurrent(): void {
		const generation = ++this.generation;
		const text = this.sentences[this.index];
		this.engine.speak(text, { voiceId: this.voiceId, rate: this.rate }).then(
			() => this.onSentenceDone(generation),
			(error: unknown) => this.onSentenceFailed(generation, error),
		);
	}

	private onSentenceDone(generation: number): void {
		if (generation !== this.generation || this.status !== 'playing') return;
		if (this.index + 1 >= this.sentences.length) {
			this.index = 0;
			this.status = 'idle';
			this.emit();
			return;
		}
		this.index++;
		this.speakCurrent();
		this.emit();
	}

	private onSentenceFailed(generation: number, error: unknown): void {
		if (generation !== this.generation) return;
		this.status = 'paused';
		this.emit();
		const err = error instanceof Error ? error : new Error(String(error));
		this.errorListeners.forEach((listener) => listener(err));
	}

	private emit(): void {
		const state = this.getState();
		this.listeners.forEach((listener) => listener(state));
	}
}
