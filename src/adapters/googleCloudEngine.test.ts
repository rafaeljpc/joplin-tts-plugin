import { AudioLike, GoogleCloudEngine } from './googleCloudEngine';

const jsonResponse = (body: unknown, ok = true, status = 200) =>
	({ ok, status, json: async () => body }) as Response;

type TestAudio = AudioLike & { src?: string };

function makeAudio(playImpl: () => Promise<void> | void = () => undefined): TestAudio {
	return {
		playbackRate: 1,
		onended: null,
		onerror: null,
		play: jest.fn(playImpl),
		pause: jest.fn(),
	};
}

function setup(responses: Response[], audio = makeAudio()) {
	const fetchFn = jest.fn();
	responses.forEach((r) => fetchFn.mockResolvedValueOnce(r));
	const createAudio = jest.fn((src: string) => {
		audio.src = src;
		return audio;
	});
	const engine = new GoogleCloudEngine({
		apiKey: 'K EY',
		languageCode: 'pt-BR',
		fetchFn,
		createAudio,
	});
	return { engine, fetchFn, createAudio, audio };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const fire = (audio: TestAudio, handler: 'onended' | 'onerror') =>
	(audio[handler] as (e: Event) => void)(new Event(handler));

describe('GoogleCloudEngine', () => {
	it('lists voices for the language', async () => {
		const { engine, fetchFn } = setup([
			jsonResponse({
				voices: [
					{ name: 'pt-BR-Wavenet-A', languageCodes: ['pt-BR'] },
					{ name: 'x', languageCodes: [] },
				],
			}),
		]);
		await expect(engine.listVoices()).resolves.toEqual([
			{ id: 'pt-BR-Wavenet-A', name: 'pt-BR-Wavenet-A', lang: 'pt-BR' },
			{ id: 'x', name: 'x', lang: 'pt-BR' },
		]);
		expect(fetchFn.mock.calls[0][0]).toContain('languageCode=pt-BR&key=K%20EY');
	});

	it('returns no voices when the API omits the list', async () => {
		const { engine } = setup([jsonResponse({})]);
		await expect(engine.listVoices()).resolves.toEqual([]);
	});

	it('synthesizes and plays with the requested rate', async () => {
		const { engine, fetchFn, audio, createAudio } = setup([jsonResponse({ audioContent: 'QUJD' })]);
		const promise = engine.speak('oi', { voiceId: 'v', rate: 1.5 });
		await tick();
		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toContain('text:synthesize?key=K%20EY');
		expect(JSON.parse(init.body)).toEqual({
			input: { text: 'oi' },
			voice: { languageCode: 'pt-BR', name: 'v' },
			audioConfig: { audioEncoding: 'MP3' },
		});
		expect(createAudio).toHaveBeenCalledWith('data:audio/mp3;base64,QUJD');
		expect(audio.playbackRate).toBe(1.5);
		fire(audio, 'onended');
		await expect(promise).resolves.toBeUndefined();
		expect(audio.pause).toHaveBeenCalled();
	});

	it('omits the voice name for the default voice', async () => {
		const { engine, fetchFn, audio } = setup([jsonResponse({ audioContent: 'QQ==' })]);
		const promise = engine.speak('x', { voiceId: '', rate: 1 });
		await tick();
		expect(JSON.parse(fetchFn.mock.calls[0][1].body).voice).toEqual({ languageCode: 'pt-BR' });
		fire(audio, 'onended');
		await promise;
	});

	it('cancel resolves the in-flight sentence', async () => {
		const { engine, audio } = setup([jsonResponse({ audioContent: 'QQ==' })]);
		const promise = engine.speak('x', { voiceId: '', rate: 1 });
		await tick();
		engine.cancel();
		await expect(promise).resolves.toBeUndefined();
		expect(audio.pause).toHaveBeenCalled();
		engine.cancel(); // second cancel is harmless
	});

	it('ignores late events from a finished sentence', async () => {
		const { engine, audio } = setup([jsonResponse({ audioContent: 'QQ==' })]);
		const promise = engine.speak('x', { voiceId: '', rate: 1 });
		await tick();
		const lateEnd = audio.onended as (e: Event) => void;
		engine.cancel();
		await promise;
		lateEnd(new Event('ended'));
		expect(audio.pause).toHaveBeenCalledTimes(1);
	});

	it('cancel during the request wins and plays nothing', async () => {
		const { engine, createAudio } = setup([jsonResponse({ audioContent: 'QQ==' })]);
		const promise = engine.speak('x', { voiceId: '', rate: 1 });
		engine.cancel();
		await expect(promise).resolves.toBeUndefined();
		expect(createAudio).not.toHaveBeenCalled();
	});

	it('rejects on playback errors', async () => {
		const { engine, audio } = setup([jsonResponse({ audioContent: 'QQ==' })]);
		const promise = engine.speak('x', { voiceId: '', rate: 1 });
		await tick();
		fire(audio, 'onerror');
		await expect(promise).rejects.toThrow('Audio playback failed');
	});

	it('rejects when play() is refused (Error and non-Error)', async () => {
		const first = setup(
			[jsonResponse({ audioContent: 'QQ==' })],
			makeAudio(() => Promise.reject(new Error('blocked'))),
		);
		await expect(first.engine.speak('x', { voiceId: '', rate: 1 })).rejects.toThrow('blocked');
		const second = setup(
			[jsonResponse({ audioContent: 'QQ==' })],
			makeAudio(() => Promise.reject('nope')),
		);
		await expect(second.engine.speak('x', { voiceId: '', rate: 1 })).rejects.toThrow('nope');
	});

	it('rejects when there is no audio content', async () => {
		const { engine } = setup([jsonResponse({})]);
		await expect(engine.speak('x', { voiceId: '', rate: 1 })).rejects.toThrow('no audio');
	});

	it('surfaces API error details', async () => {
		const { engine } = setup([
			jsonResponse({ error: { message: 'API key not valid' } }, false, 400),
		]);
		await expect(engine.listVoices()).rejects.toThrow('Google TTS error 400: API key not valid');
	});

	it('handles error bodies that are not JSON or lack a message', async () => {
		const broken = {
			ok: false,
			status: 500,
			json: async () => {
				throw new Error('x');
			},
		} as unknown as Response;
		const { engine } = setup([
			broken,
			jsonResponse({ error: {} }, false, 403),
			jsonResponse({}, false, 502),
		]);
		await expect(engine.listVoices()).rejects.toThrow('Google TTS error 500');
		await expect(engine.listVoices()).rejects.toThrow('Google TTS error 403');
		await expect(engine.listVoices()).rejects.toThrow('Google TTS error 502');
	});
});

describe('GoogleCloudEngine prefetch', () => {
	const options = { voiceId: 'v', rate: 1 };

	it('synthesizes the next sentence ahead of time and reuses it', async () => {
		const { engine, fetchFn, audio } = setup([jsonResponse({ audioContent: 'QUJD' })]);
		engine.prefetch('Next.', options);
		await tick();
		expect(fetchFn).toHaveBeenCalledTimes(1);
		const speaking = engine.speak('Next.', options);
		await tick();
		expect(audio.src).toBe('data:audio/mp3;base64,QUJD');
		fire(audio, 'onended');
		await speaking;
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it('synthesizes again when the background request failed', async () => {
		const { engine, fetchFn, audio } = setup([
			jsonResponse({}, false, 500),
			jsonResponse({ audioContent: 'QUJD' }),
		]);
		engine.prefetch('Next.', options);
		await tick();
		const speaking = engine.speak('Next.', options);
		await tick();
		fire(audio, 'onended');
		await speaking;
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});
});
