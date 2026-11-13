import { AudioLike, AudioSlot, GESTURE_ERROR } from './audioSlot';

function setup(playImpl: () => Promise<void> | void = () => undefined) {
	const elements: AudioLike[] = [];
	const createAudio = jest.fn((src?: string) => {
		const audio: AudioLike = {
			src: src ?? '',
			playbackRate: 1,
			onended: null,
			onerror: null,
			play: jest.fn(playImpl),
			pause: jest.fn(),
		};
		elements.push(audio);
		return audio;
	});
	return { slot: new AudioSlot(createAudio), elements, createAudio };
}

describe('AudioSlot', () => {
	it('creates the element on the first play and reuses it with a new src', async () => {
		const { slot, elements, createAudio } = setup();
		expect(createAudio).not.toHaveBeenCalled();
		const first = slot.play('a', 1.5);
		const audio = elements[0];
		expect(audio.src).toBe('a');
		expect(audio.playbackRate).toBe(1.5);
		(audio.onended as () => void)();
		await first;
		const second = slot.play('b', 2);
		expect(elements).toHaveLength(1);
		expect(audio.src).toBe('b');
		expect(audio.playbackRate).toBe(2);
		(audio.onended as () => void)();
		await second;
	});

	it('detaches the previous sentence when a new one starts', async () => {
		const { slot, elements } = setup();
		const first = slot.play('a', 1);
		const lateEnd = elements[0].onended as () => void;
		const second = slot.play('b', 1);
		await expect(first).resolves.toBeUndefined();
		lateEnd(); // stale handler of the replaced sentence: ignored
		expect(elements[0].pause).toHaveBeenCalledTimes(1);
		slot.cancel();
		await expect(second).resolves.toBeUndefined();
	});

	it('preloads through a throwaway element, once per src', () => {
		const { slot, elements } = setup();
		slot.preload('a');
		slot.preload('a');
		slot.preload('b');
		expect(elements).toHaveLength(2);
		expect(elements[0].preload).toBe('auto');
		slot.play('b', 1);
		expect(elements).toHaveLength(3);
		expect(elements[2].src).toBe('b');
	});

	it('cancel pauses and keeps the element for reuse', async () => {
		const { slot, elements } = setup();
		const playing = slot.play('a', 1);
		slot.cancel();
		await expect(playing).resolves.toBeUndefined();
		slot.cancel();
		void slot.play('b', 1);
		expect(elements).toHaveLength(1);
	});

	it('rejects with a clear error when the browser requires a user gesture', async () => {
		const { slot } = setup(() =>
			Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })),
		);
		await expect(slot.play('a', 1)).rejects.toThrow(GESTURE_ERROR);
	});

	it('rejects when play() fails with an Error, a non-Error, or the element errors', async () => {
		await expect(setup(() => Promise.reject(new Error('boom'))).slot.play('a', 1)).rejects.toThrow(
			'boom',
		);
		await expect(setup(() => Promise.reject('text')).slot.play('a', 1)).rejects.toThrow('text');
		await expect(setup(() => Promise.reject(null)).slot.play('a', 1)).rejects.toThrow('null');
		const { slot, elements } = setup();
		const playing = slot.play('a', 1);
		(elements[0].onerror as () => void)();
		await expect(playing).rejects.toThrow('Audio playback failed');
	});
});
