export interface AudioLike {
	src: string;
	playbackRate: number;
	preservesPitch?: boolean;
	preload?: string;
	onended: HTMLMediaElement['onended'];
	onerror: HTMLMediaElement['onerror'];
	play(): Promise<void> | void;
	pause(): void;
}

export type CreateAudio = (src?: string) => AudioLike;

/** Autoplay policies (Android WebView) reject play() outside a user gesture with this error. */
export const GESTURE_ERROR = 'play() needs a user gesture';

const isGestureError = (e: unknown): boolean =>
	typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'NotAllowedError';

/**
 * Plays one audio source at a time, always through ONE persistent audio
 * element. Mobile WebViews only allow play() on an element that a user gesture
 * has already started, so a fresh element per sentence would be blocked from
 * the second sentence on. The promise from `play` resolves when the audio ends
 * or is cancelled and rejects when playback fails.
 */
export class AudioSlot {
	private player: AudioLike | null = null;
	private active = 0;
	private cancelCurrent: (() => void) | null = null;
	// Throwaway element that only warms the HTTP cache; kept referenced until replaced.
	private warmed: { src: string; audio: AudioLike } | null = null;

	constructor(private createAudio: CreateAudio) {}

	/** Starts fetching `src` so a later `play(src)` starts without waiting. */
	preload(src: string): void {
		if (this.warmed?.src === src) return;
		const audio = this.createAudio(src);
		audio.preload = 'auto';
		this.warmed = { src, audio };
	}

	play(src: string, rate: number): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			// Created on the first play, which happens inside the user's tap.
			const audio = (this.player ??= this.createAudio());
			// A sentence still playing is ended (resolved) before the element is reused.
			this.cancelCurrent?.();
			const id = ++this.active;
			audio.onended = () => this.finish(id, resolve);
			audio.onerror = () => this.finish(id, () => reject(new Error('Audio playback failed')));
			audio.src = src;
			// Setting src resets the rate, so it is set afterwards.
			audio.playbackRate = rate;
			audio.preservesPitch = true;
			this.cancelCurrent = () => this.finish(id, resolve);
			Promise.resolve(audio.play()).catch((e: unknown) =>
				this.finish(id, () =>
					reject(
						isGestureError(e)
							? new Error(GESTURE_ERROR)
							: e instanceof Error
								? e
								: new Error(String(e)),
					),
				),
			);
		});
	}

	cancel(): void {
		this.cancelCurrent?.();
	}

	private finish(id: number, done: () => void): void {
		if (this.active !== id || !this.cancelCurrent) return;
		this.cancelCurrent = null;
		const audio = this.player!;
		audio.onended = null;
		audio.onerror = null;
		audio.pause();
		done();
	}
}
