import { AudioLike } from './audioSlot';
import { AzureSpeechEngine } from './azureEngine';

const tick = () => new Promise((r) => setTimeout(r, 0));

const VOICES = [
	{ ShortName: 'pt-BR-FranciscaNeural', LocalName: 'Francisca', Locale: 'pt-BR', Gender: 'Female' },
	{ ShortName: 'pt-PT-DuarteNeural', DisplayName: 'Duarte', Locale: 'pt-PT' },
	{ ShortName: 'en-US-GuyNeural', LocalName: 'Guy', Locale: 'en-US', Gender: 'Male' },
	{ ShortName: 'pt-BR-NoNames', Locale: 'pt-BR' },
];

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const audioResponse = () =>
	({ ok: true, status: 200, blob: async () => new Blob(['mp3']) }) as Response;
const failure = (status: number) => ({ ok: false, status }) as Response;

function setup(languageCode = 'pt-BR') {
	const audio: AudioLike = {
		playbackRate: 1,
		onended: null,
		onerror: null,
		play: jest.fn(),
		pause: jest.fn(),
	};
	const fetchFn = jest.fn();
	const createObjectUrl = jest.fn(() => 'blob:audio');
	const revokeObjectUrl = jest.fn();
	const engine = new AzureSpeechEngine({
		apiKey: 'KEY',
		region: 'brazil south',
		languageCode,
		fetchFn,
		createAudio: () => audio,
		createObjectUrl,
		revokeObjectUrl,
	});
	const end = () => (audio.onended as (e: Event) => void)(new Event('ended'));
	return { engine, fetchFn, audio, createObjectUrl, revokeObjectUrl, end };
}

describe('AzureSpeechEngine', () => {
	it('lists voices of the configured language, once', async () => {
		const { engine, fetchFn } = setup();
		fetchFn.mockResolvedValueOnce(ok(VOICES));
		const voices = await engine.listVoices();
		expect(voices.map((v) => v.id)).toEqual([
			'pt-BR-FranciscaNeural',
			'pt-PT-DuarteNeural',
			'pt-BR-NoNames',
		]);
		expect(voices.map((v) => v.name)).toEqual(['Francisca (Female)', 'Duarte', 'pt-BR-NoNames']);
		await engine.listVoices();
		expect(fetchFn).toHaveBeenCalledTimes(1);
		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe(
			'https://brazil%20south.tts.speech.microsoft.com/cognitiveservices/voices/list',
		);
		expect(init.headers['Ocp-Apim-Subscription-Key']).toBe('KEY');
	});

	it('does not cache a failed voice list', async () => {
		const { engine, fetchFn } = setup();
		fetchFn.mockResolvedValueOnce(failure(401)).mockResolvedValueOnce(ok(VOICES));
		await expect(engine.listVoices()).rejects.toThrow('Azure TTS error 401');
		await expect(engine.listVoices()).resolves.toHaveLength(3);
	});

	it('synthesizes SSML with the chosen voice and plays the blob', async () => {
		const { engine, fetchFn, audio, createObjectUrl, revokeObjectUrl, end } = setup();
		fetchFn.mockResolvedValueOnce(audioResponse());
		const promise = engine.speak('A <b> & "c"', { voiceId: 'pt-BR-FranciscaNeural', rate: 1.25 });
		await tick();
		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe('https://brazil%20south.tts.speech.microsoft.com/cognitiveservices/v1');
		expect(init.headers['Content-Type']).toBe('application/ssml+xml');
		expect(init.headers['X-Microsoft-OutputFormat']).toBe('audio-24khz-48kbitrate-mono-mp3');
		expect(init.body).toBe(
			"<speak version='1.0' xml:lang='pt-BR'><voice name='pt-BR-FranciscaNeural'>A &#60;b&#62; &#38; &#34;c&#34;</voice></speak>",
		);
		expect(audio.playbackRate).toBe(1.25);
		expect(createObjectUrl).toHaveBeenCalled();
		end();
		await promise;
		expect(revokeObjectUrl).toHaveBeenCalledWith('blob:audio');
	});

	it('picks the exact-locale voice when none is selected', async () => {
		const { engine, fetchFn, end } = setup('pt-PT');
		fetchFn.mockResolvedValueOnce(ok(VOICES)).mockResolvedValueOnce(audioResponse());
		const promise = engine.speak('Olá', { voiceId: '', rate: 1 });
		await tick();
		expect(fetchFn.mock.calls[1][1].body).toContain("<voice name='pt-PT-DuarteNeural'>");
		end();
		await promise;
	});

	it('falls back to the first voice of the language', async () => {
		const { engine, fetchFn, end } = setup('pt');
		fetchFn.mockResolvedValueOnce(ok(VOICES)).mockResolvedValueOnce(audioResponse());
		const promise = engine.speak('Olá', { voiceId: '', rate: 1 });
		await tick();
		expect(fetchFn.mock.calls[1][1].body).toContain("<voice name='pt-BR-FranciscaNeural'>");
		end();
		await promise;
	});

	it('fails clearly when the language has no voice', async () => {
		const { engine, fetchFn } = setup('xx-YY');
		fetchFn.mockResolvedValueOnce(ok(VOICES));
		await expect(engine.speak('x', { voiceId: '', rate: 1 })).rejects.toThrow(
			'No Azure voice available for xx-YY',
		);
	});

	it('uses the configured language when the voice name has no locale prefix', async () => {
		const { engine, fetchFn, end } = setup();
		fetchFn.mockResolvedValueOnce(audioResponse());
		const promise = engine.speak('x', { voiceId: 'Custom', rate: 1 });
		await tick();
		expect(fetchFn.mock.calls[0][1].body).toContain("xml:lang='pt-BR'");
		end();
		await promise;
	});

	it('surfaces synthesis errors', async () => {
		const { engine, fetchFn } = setup();
		fetchFn.mockResolvedValueOnce(failure(403));
		await expect(engine.speak('x', { voiceId: 'v', rate: 1 })).rejects.toThrow(
			'Azure TTS error 403',
		);
	});

	it('cancel during the request wins and creates no audio', async () => {
		const { engine, fetchFn, createObjectUrl } = setup();
		fetchFn.mockResolvedValueOnce(audioResponse());
		const promise = engine.speak('x', { voiceId: 'v', rate: 1 });
		engine.cancel();
		await expect(promise).resolves.toBeUndefined();
		expect(createObjectUrl).not.toHaveBeenCalled();
	});

	it('cancel during playback resolves and revokes the URL', async () => {
		const { engine, fetchFn, revokeObjectUrl } = setup();
		fetchFn.mockResolvedValueOnce(audioResponse());
		const promise = engine.speak('x', { voiceId: 'v', rate: 1 });
		await tick();
		engine.cancel();
		await promise;
		expect(revokeObjectUrl).toHaveBeenCalledWith('blob:audio');
	});
});

describe('AzureSpeechEngine prefetch', () => {
	const options = { voiceId: 'pt-BR-FranciscaNeural', rate: 1 };

	it('fetches the next sentence ahead of time and reuses it', async () => {
		const { engine, fetchFn, end } = setup();
		fetchFn.mockResolvedValue(audioResponse());
		engine.prefetch('Next.', options);
		engine.prefetch('Next.', options);
		await tick();
		expect(fetchFn).toHaveBeenCalledTimes(1);
		const speaking = engine.speak('Next.', options);
		await tick();
		end();
		await speaking;
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it('fetches again when the background request failed', async () => {
		const { engine, fetchFn, end } = setup();
		fetchFn.mockResolvedValueOnce(failure(500)).mockResolvedValueOnce(audioResponse());
		engine.prefetch('Next.', options);
		await tick();
		const speaking = engine.speak('Next.', options);
		await tick();
		end();
		await speaking;
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});
});
