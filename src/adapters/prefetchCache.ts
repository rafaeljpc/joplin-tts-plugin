/**
 * Holds the result being prepared for the NEXT sentence, so the engine can
 * fetch it while the current one is still playing. Only one entry is kept.
 */
export class PrefetchCache<T> {
	private entry: { key: string; promise: Promise<T> } | null = null;

	/** Starts loading `key` in the background. Failures are ignored here. */
	prefetch(key: string, load: () => Promise<T>): void {
		if (this.entry?.key === key) return;
		const promise = load();
		promise.catch(() => undefined);
		this.entry = { key, promise };
	}

	/** Returns the prefetched value for `key`, or loads it now. */
	async take(key: string, load: () => Promise<T>): Promise<T> {
		const hit = this.entry?.key === key ? this.entry : null;
		if (hit) {
			this.entry = null;
			try {
				return await hit.promise;
			} catch {
				// The background attempt failed: try once more, for real.
			}
		}
		return load();
	}
}
