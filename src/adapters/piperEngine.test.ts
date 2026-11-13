import { AudioLike } from './audioSlot';
import { PiperEngine } from './piperEngine';

function setup() {
	const played: { src: string; rate: number }[] = [];
	const audios: AudioLike[] = [];
	const createAudio = (): AudioLike => {
		const audio: AudioLike = {
			src: '',
			playbackRate: 1,
			onended: null,
			onerror: null,
			pause: jest.fn(),
			play: () => {
				played.push({ src: audio.src, rate: audio.playbackRate });
				// Never ends by itself: the test ends it (or cancels).
			},
		};
		audios.push(audio);
		return audio;
	};
	const request = jest.fn(async (message: { type: string; text?: string }) =>
		message.type === 'piperVoices'
			? { voices: [{ id: 'v1', name: 'Voice 1', lang: 'pt_BR' }] }
			: { ok: true, wav: `wav:${message.text}` },
	);
	const engine = new PiperEngine({ request, createAudio });
	return { engine, request, played, audios };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PiperEngine', () => {
	it('lists the downloaded voices', async () => {
		const { engine, request } = setup();
		await expect(engine.listVoices()).resolves.toEqual([
			{ id: 'v1', name: 'Voice 1', lang: 'pt_BR' },
		]);
		expect(request).toHaveBeenCalledWith({ type: 'piperVoices' });
	});

	it('lists nothing when the plugin does not answer', async () => {
		const { engine, request } = setup();
		request.mockResolvedValueOnce(null as never);
		await expect(engine.listVoices()).resolves.toEqual([]);
	});

	it('synthesizes a sentence through the plugin and plays the WAV at the chosen rate', async () => {
		const { engine, request, played, audios } = setup();
		const speaking = engine.speak('Olá.', { voiceId: 'v1', rate: 1.5 });
		await tick();
		expect(request).toHaveBeenCalledWith({ type: 'piperSynthesize', text: 'Olá.', voiceId: 'v1' });
		expect(played).toEqual([{ src: 'data:audio/wav;base64,wav:Olá.', rate: 1.5 }]);
		(audios[0].onended as () => void)();
		await expect(speaking).resolves.toBeUndefined();
	});

	it('uses the audio fetched ahead of time', async () => {
		const { engine, request, audios } = setup();
		engine.prefetch('Next.', { voiceId: 'v1', rate: 1 });
		await tick();
		const speaking = engine.speak('Next.', { voiceId: 'v1', rate: 1 });
		await tick();
		expect(request.mock.calls.filter(([m]) => m.type === 'piperSynthesize')).toHaveLength(1);
		(audios[0].onended as () => void)();
		await speaking;
	});

	it('fails with the reason given by the plugin, or a default one', async () => {
		const { engine, request } = setup();
		request.mockResolvedValueOnce({ ok: false, error: 'No Piper voice downloaded' } as never);
		await expect(engine.speak('a', { voiceId: '', rate: 1 })).rejects.toThrow('No Piper voice');
		request.mockResolvedValueOnce(null as never);
		await expect(engine.speak('b', { voiceId: '', rate: 1 })).rejects.toThrow('could not speak');
	});

	it('does not play a sentence cancelled while it was being synthesized', async () => {
		const { engine, request, played } = setup();
		let answer: (value: unknown) => void = () => undefined;
		request.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)) as never);
		const speaking = engine.speak('late', { voiceId: 'v1', rate: 1 });
		engine.cancel();
		answer({ ok: true, wav: 'x' });
		await speaking;
		expect(played).toEqual([]);
	});

	it('cancel stops the sentence that is playing', async () => {
		const { engine, audios } = setup();
		const speaking = engine.speak('now', { voiceId: 'v1', rate: 1 });
		await tick();
		engine.cancel();
		await expect(speaking).resolves.toBeUndefined();
		expect(audios[0].pause).toHaveBeenCalled();
	});
});
