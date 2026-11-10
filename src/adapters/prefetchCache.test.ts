import { PrefetchCache } from './prefetchCache';

describe('PrefetchCache', () => {
	it('loads on demand when nothing was prefetched', async () => {
		const cache = new PrefetchCache<string>();
		await expect(cache.take('a', async () => 'fresh')).resolves.toBe('fresh');
	});

	it('hands out the prefetched value once, without loading again', async () => {
		const cache = new PrefetchCache<string>();
		const load = jest.fn(async () => 'early');
		cache.prefetch('a', load);
		cache.prefetch('a', load);
		expect(load).toHaveBeenCalledTimes(1);
		await expect(cache.take('a', async () => 'late')).resolves.toBe('early');
		await expect(cache.take('a', async () => 'late')).resolves.toBe('late');
	});

	it('keeps only the latest entry', async () => {
		const cache = new PrefetchCache<string>();
		cache.prefetch('a', async () => 'A');
		cache.prefetch('b', async () => 'B');
		await expect(cache.take('a', async () => 'fresh')).resolves.toBe('fresh');
		await expect(cache.take('b', async () => 'fresh')).resolves.toBe('B');
	});

	it('loads again when the background attempt failed, without unhandled rejections', async () => {
		const cache = new PrefetchCache<string>();
		cache.prefetch('a', () => Promise.reject(new Error('boom')));
		await expect(cache.take('a', async () => 'retry')).resolves.toBe('retry');
	});
});
