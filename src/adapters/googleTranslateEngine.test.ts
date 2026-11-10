import { AudioLike } from './audioSlot';
import { GOOGLE_TRANSLATE_VOICES, GoogleTranslateEngine, MAX_CHARS } from './googleTranslateEngine';

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup() {
	const created: { src: string; audio: AudioLike }[] = [];
	const createAudio = jest.fn((src: string) => {
		const audio: AudioLike = {
			playbackRate: 1,
			onended: null,
			onerror: null,
			play: jest.fn(),
			pause: jest.fn(),
		};
		created.push({ src, audio });
		return audio;
	});
	const engine = new GoogleTranslateEngine({ languageCode: 'pt-BR', createAudio });
	const end = (i: number) => (created[i].audio.onended as (e: Event) => void)(new Event('ended'));
	return { engine, created, end };
}

describe('GoogleTranslateEngine', () => {
	it('lists one voice per language', async () => {
		const { engine } = setup();
		const voices = await engine.listVoices();
		expect(voices).toBe(GOOGLE_TRANSLATE_VOICES);
		expect(voices.find((v) => v.id === 'pt-BR')?.name).toBe('Portuguese (Brazil)');
	});

	it('plays a sentence in the default language at the requested rate', async () => {
		const { engine, created, end } = setup();
		const promise = engine.speak('Olá, mundo.', { voiceId: '', rate: 1.5 });
		const url = new URL(created[0].src);
		expect(url.origin + url.pathname).toBe('https://translate.google.com/translate_tts');
		expect(url.searchParams.get('tl')).toBe('pt-BR');
		expect(url.searchParams.get('q')).toBe('Olá, mundo.');
		expect(url.searchParams.get('client')).toBe('tw-ob');
		expect(created[0].audio.playbackRate).toBe(1.5);
		end(0);
		await expect(promise).resolves.toBeUndefined();
	});

	it('uses the selected voice as the language', async () => {
		const { engine, created, end } = setup();
		const promise = engine.speak('Hi', { voiceId: 'en-GB', rate: 1 });
		expect(new URL(created[0].src).searchParams.get('tl')).toBe('en-GB');
		end(0);
		await promise;
	});

	it('splits long sentences into sequential requests', async () => {
		const { engine, created, end } = setup();
		const text = `${'word '.repeat(60).trim()}.`;
		const promise = engine.speak(text, { voiceId: '', rate: 1 });
		expect(created).toHaveLength(1);
		end(0);
		await tick();
		expect(created.length).toBeGreaterThan(1);
		for (let i = 1; i < created.length; i++) {
			end(i);
			await tick();
		}
		await promise;
		for (const { src } of created) {
			expect(new URL(src).searchParams.get('q')!.length).toBeLessThanOrEqual(MAX_CHARS);
		}
	});

	it('stops requesting chunks after a cancel', async () => {
		const { engine, created } = setup();
		const promise = engine.speak('word '.repeat(80), { voiceId: '', rate: 1 });
		engine.cancel();
		await expect(promise).resolves.toBeUndefined();
		await tick();
		expect(created).toHaveLength(1);
	});

	it('propagates playback errors', async () => {
		const { engine, created } = setup();
		const promise = engine.speak('Hello', { voiceId: '', rate: 1 });
		(created[0].audio.onerror as (e: Event) => void)(new Event('error'));
		await expect(promise).rejects.toThrow('Audio playback failed');
	});
});

describe('GoogleTranslateEngine prefetch', () => {
	it('preloads the next sentence once and plays that same audio element', async () => {
		const { engine, created, end } = setup();
		engine.prefetch('Next one.', { voiceId: '', rate: 1 });
		engine.prefetch('Next one.', { voiceId: '', rate: 1 });
		expect(created).toHaveLength(1);
		expect(created[0].audio.preload).toBe('auto');
		expect(new URL(created[0].src).searchParams.get('tl')).toBe('pt-BR');

		const speaking = engine.speak('Next one.', { voiceId: '', rate: 2 });
		await tick();
		expect(created).toHaveLength(1);
		expect(created[0].audio.playbackRate).toBe(2);
		expect(created[0].audio.play).toHaveBeenCalled();
		end(0);
		await speaking;
	});

	it('ignores a preload that does not match, and empty text', async () => {
		const { engine, created, end } = setup();
		engine.prefetch('', { voiceId: 'en', rate: 1 });
		expect(created).toHaveLength(0);
		engine.prefetch('Other.', { voiceId: 'en', rate: 1 });
		const speaking = engine.speak('Different.', { voiceId: 'en', rate: 1 });
		await tick();
		expect(created).toHaveLength(2);
		end(1);
		await speaking;
	});
});
