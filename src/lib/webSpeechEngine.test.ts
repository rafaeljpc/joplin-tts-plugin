import { WebSpeechEngine } from './webSpeechEngine';

class FakeUtterance {
	rate = 1;
	voice: unknown = null;
	lang = '';
	onend: (() => void) | null = null;
	onerror: ((e: { error: string }) => void) | null = null;
	constructor(public text: string) {}
}

const voice = (uri: string, lang = 'en-US') => ({ voiceURI: uri, name: `N-${uri}`, lang });

function makeSynth(voices: ReturnType<typeof voice>[]) {
	const listeners: Record<string, (() => void)[]> = {};
	const synth = {
		getVoices: jest.fn(() => voices),
		speak: jest.fn(),
		cancel: jest.fn(),
		addEventListener: jest.fn((name: string, cb: () => void) => {
			(listeners[name] ??= []).push(cb);
		}),
		removeEventListener: jest.fn(),
	};
	return { synth, listeners };
}

const engineFor = (synth: unknown) =>
	new WebSpeechEngine(
		synth as SpeechSynthesis,
		FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
	);

describe('WebSpeechEngine', () => {
	it('detects support', () => {
		expect(WebSpeechEngine.isSupported({})).toBe(false);
		expect(WebSpeechEngine.isSupported({ speechSynthesis: {} as SpeechSynthesis })).toBe(true);
	});

	it('lists voices immediately when available', async () => {
		const { synth } = makeSynth([voice('a')]);
		await expect(engineFor(synth).listVoices()).resolves.toEqual([
			{ id: 'a', name: 'N-a', lang: 'en-US' },
		]);
	});

	it('waits for voiceschanged when the list is empty', async () => {
		const voices: ReturnType<typeof voice>[] = [];
		const { synth, listeners } = makeSynth(voices);
		const promise = engineFor(synth).listVoices();
		voices.push(voice('late'));
		listeners['voiceschanged'][0]();
		await expect(promise).resolves.toHaveLength(1);
	});

	it('gives up waiting after the timeout', async () => {
		jest.useFakeTimers();
		const { synth } = makeSynth([]);
		const promise = engineFor(synth).listVoices();
		jest.advanceTimersByTime(2000);
		await expect(promise).resolves.toEqual([]);
		jest.useRealTimers();
	});

	it('speaks with the selected voice and rate, resolving on end', async () => {
		const { synth } = makeSynth([voice('a', 'pt-BR')]);
		const promise = engineFor(synth).speak('oi', { voiceId: 'a', rate: 1.5 });
		const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
		expect(utterance).toMatchObject({ text: 'oi', rate: 1.5, lang: 'pt-BR' });
		utterance.onend?.();
		await expect(promise).resolves.toBeUndefined();
	});

	it('uses the default voice when the id is unknown', async () => {
		const { synth } = makeSynth([voice('a')]);
		const promise = engineFor(synth).speak('x', { voiceId: 'missing', rate: 1 });
		const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
		expect(utterance.voice).toBeNull();
		utterance.onend?.();
		await promise;
	});

	it.each(['canceled', 'interrupted'])('treats %s as a normal end', async (error) => {
		const { synth } = makeSynth([]);
		const promise = engineFor(synth).speak('x', { voiceId: '', rate: 1 });
		(synth.speak.mock.calls[0][0] as FakeUtterance).onerror?.({ error });
		await expect(promise).resolves.toBeUndefined();
	});

	it('rejects on real errors', async () => {
		const { synth } = makeSynth([]);
		const promise = engineFor(synth).speak('x', { voiceId: '', rate: 1 });
		(synth.speak.mock.calls[0][0] as FakeUtterance).onerror?.({ error: 'synthesis-failed' });
		await expect(promise).rejects.toThrow('synthesis-failed');
	});

	it('cancels', () => {
		const { synth } = makeSynth([]);
		engineFor(synth).cancel();
		expect(synth.cancel).toHaveBeenCalled();
	});
});
