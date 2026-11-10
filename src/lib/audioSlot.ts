export interface AudioLike {
	playbackRate: number;
	preservesPitch?: boolean;
	onended: HTMLMediaElement['onended'];
	onerror: HTMLMediaElement['onerror'];
	play(): Promise<void> | void;
	pause(): void;
}

export type CreateAudio = (src: string) => AudioLike;

/**
 * Plays one audio source at a time. The promise from `play` resolves when the
 * audio ends or is cancelled and rejects when playback fails.
 */
export class AudioSlot {
	private current: AudioLike | null = null;
	private cancelCurrent: (() => void) | null = null;

	constructor(private createAudio: CreateAudio) {}

	play(src: string, rate: number): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const audio = this.createAudio(src);
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
}
