import { getStrings } from '../lib/i18n';
import { DEFAULT_SETTINGS } from '../lib/settings';
import { PluginToPanelMessage, Settings } from '../lib/types';
import { createEngine, initPlayer, unwrapMessage, WebviewApiLike, WebviewScope } from './player';

const t = getStrings('en');
const flush = () => new Promise((r) => setTimeout(r, 0));

class FakeUtterance {
	rate = 1;
	voice: unknown = null;
	lang = '';
	onend: (() => void) | null = null;
	onerror: ((e: { error: string }) => void) | null = null;
	constructor(public text: string) {}
}

function makeScope(overrides: Partial<WebviewScope> = {}) {
	const spoken: FakeUtterance[] = [];
	const synth = {
		getVoices: jest.fn(() => [
			{ voiceURI: 'b', name: 'Bravo', lang: 'pt-BR' },
			{ voiceURI: 'a', name: 'Alpha', lang: 'en-US' },
		]),
		speak: jest.fn((u: FakeUtterance) => spoken.push(u)),
		cancel: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
	};
	const scope: WebviewScope = {
		speechSynthesis: synth as unknown as SpeechSynthesis,
		SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
		fetch: jest.fn() as unknown as typeof fetch,
		Audio: jest.fn() as unknown as typeof Audio,
		navigator: { language: 'en-US' },
		...overrides,
	};
	return { scope, synth, spoken };
}

function setup(scopeOverrides: Partial<WebviewScope> = {}) {
	document.body.innerHTML = '<div id="tts-root"></div>';
	const posted: unknown[] = [];
	let listener: (m: unknown) => void = () => undefined;
	const api: WebviewApiLike = {
		postMessage: jest.fn(async (m) => {
			posted.push(m);
		}),
		onMessage: (cb) => {
			listener = cb;
		},
	};
	const { scope, synth, spoken } = makeScope(scopeOverrides);
	const player = initPlayer(document, api, scope);
	const send = async (m: PluginToPanelMessage | unknown) => {
		listener(m);
		await flush();
	};
	const q = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
	return { player, send, posted, q, synth, spoken, scope };
}

const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

describe('unwrapMessage', () => {
	it('accepts direct and wrapped payloads and rejects garbage', () => {
		expect(unwrapMessage({ type: 'stop' })).toEqual({ type: 'stop' });
		expect(unwrapMessage({ message: { type: 'stop' } })).toEqual({ type: 'stop' });
		expect(unwrapMessage(null)).toBeNull();
		expect(unwrapMessage({ foo: 1 })).toBeNull();
		expect(unwrapMessage('x')).toBeNull();
	});
});

describe('createEngine', () => {
	it('creates the Web Speech engine', async () => {
		const { scope } = makeScope();
		const engine = createEngine(settings(), scope, t);
		await expect(engine.listVoices()).resolves.toHaveLength(2);
	});

	it('explains when speech synthesis is unavailable', async () => {
		const { scope } = makeScope({ speechSynthesis: undefined });
		const engine = createEngine(settings(), scope, t);
		await expect(engine.listVoices()).resolves.toEqual([]);
		await expect(engine.speak('x', { voiceId: '', rate: 1 })).rejects.toThrow(t.unsupported);
		engine.cancel();
	});

	it('requires an API key for Google', async () => {
		const { scope } = makeScope();
		const engine = createEngine(settings({ engine: 'google' }), scope, t);
		await expect(engine.speak('x', { voiceId: '', rate: 1 })).rejects.toThrow(t.missingApiKey);
	});

	it('wires fetch and Audio into the Google engine', async () => {
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				voices: [{ name: 'g1', languageCodes: ['en-US'] }],
				audioContent: 'QQ==',
			}),
		});
		const audio = {
			playbackRate: 1,
			onended: null as null | (() => void),
			onerror: null,
			play: jest.fn(),
			pause: jest.fn(),
		};
		const AudioMock = jest.fn(() => audio);
		const { scope } = makeScope({
			fetch: fetchMock as unknown as typeof fetch,
			Audio: AudioMock as unknown as typeof Audio,
		});
		const engine = createEngine(settings({ engine: 'google', googleApiKey: 'k' }), scope, t);
		await expect(engine.listVoices()).resolves.toHaveLength(1);
		const speaking = engine.speak('hi', { voiceId: 'g1', rate: 1 });
		await flush();
		expect(AudioMock).toHaveBeenCalledWith('data:audio/mp3;base64,QQ==');
		audio.onended?.();
		await speaking;
	});
});

describe('initPlayer', () => {
	it('throws without the root element', () => {
		document.body.innerHTML = '';
		const { scope } = makeScope();
		expect(() =>
			initPlayer(document, { postMessage: jest.fn(), onMessage: jest.fn() } as never, scope),
		).toThrow('#tts-root');
	});

	it('announces readiness and renders an empty state', () => {
		const { posted, q } = setup();
		expect(posted).toEqual([{ type: 'ready' }]);
		expect(q('.tts-sentence').textContent).toBe(t.ready);
		expect(q<HTMLButtonElement>('.tts-play').disabled).toBe(true);
	});

	it('ignores unknown messages', async () => {
		const { send, q } = setup();
		await send({ nope: true });
		expect(q('.tts-sentence').textContent).toBe(t.ready);
	});

	it('fills voices (sorted) and rates from init', async () => {
		const { send, q } = setup();
		await send({ type: 'init', settings: settings({ voice: 'a', rate: 1.1 }) });
		const voices = [...q('.tts-voice').querySelectorAll('option')].map((o) => o.textContent);
		expect(voices).toEqual([t.defaultVoice, 'Alpha (en-US)', 'Bravo (pt-BR)']);
		expect(q<HTMLSelectElement>('.tts-voice').value).toBe('a');
		const rates = [...q('.tts-rate').querySelectorAll('option')].map((o) => o.textContent);
		expect(rates).toEqual(['0.75×', '1×', '1.1×', '1.25×', '1.5×', '2×']);
		expect(q<HTMLSelectElement>('.tts-rate').value).toBe('1.1');
	});

	it('loads a note and plays/pauses/navigates', async () => {
		const { send, q, spoken, player } = setup();
		await send({ type: 'init', settings: settings() });
		await send({ type: 'load', title: 'My note', sentences: ['One.', 'Two.'], autoplay: true });
		expect(q('.tts-title').textContent).toBe('My note');
		expect(q('.tts-sentence').textContent).toBe('One.');
		expect(q('.tts-counter').textContent).toBe('Sentence 1 of 2');
		expect(q<HTMLProgressElement>('.tts-progress').value).toBe(0.5);
		expect(spoken[0].text).toBe('One.');
		expect(q('.tts-play').textContent).toBe('⏸');

		q<HTMLButtonElement>('.tts-play').click();
		expect(player.getController().getState().status).toBe('paused');
		expect(q('.tts-play').textContent).toBe('▶');

		q<HTMLButtonElement>('.tts-next').click();
		expect(q('.tts-sentence').textContent).toBe('Two.');
		q<HTMLButtonElement>('.tts-prev').click();
		expect(q('.tts-sentence').textContent).toBe('One.');
		q<HTMLButtonElement>('.tts-next').click();
		q<HTMLButtonElement>('.tts-stop').click();
		expect(q('.tts-sentence').textContent).toBe('One.');
	});

	it('loads without autoplay and shows the empty-note message', async () => {
		const { send, q, spoken } = setup();
		await send({ type: 'init', settings: settings() });
		await send({ type: 'load', title: 'Empty', sentences: [], autoplay: false });
		expect(q('.tts-sentence').textContent).toBe(t.empty);
		expect(q('.tts-counter').textContent).toBe('');
		expect(spoken).toHaveLength(0);
		await send({ type: 'load', title: '', sentences: [], autoplay: false });
		expect(q('.tts-title').textContent).toBe(t.title);
		expect(q('.tts-sentence').textContent).toBe(t.ready);
	});

	it('stops on a stop message', async () => {
		const { send, player } = setup();
		await send({ type: 'init', settings: settings() });
		await send({ type: 'load', title: 'n', sentences: ['A.'], autoplay: true });
		await send({ type: 'stop' });
		expect(player.getController().getState().status).toBe('idle');
	});

	it('persists voice and rate changes', async () => {
		const { send, q, posted, player } = setup();
		await send({ type: 'init', settings: settings() });
		const rate = q<HTMLSelectElement>('.tts-rate');
		rate.value = '1.5';
		rate.onchange?.(new Event('change'));
		const voice = q<HTMLSelectElement>('.tts-voice');
		voice.value = 'b';
		voice.onchange?.(new Event('change'));
		expect(posted).toContainEqual({ type: 'saveSettings', patch: { rate: 1.5 } });
		expect(posted).toContainEqual({ type: 'saveSettings', patch: { voice: 'b' } });
		expect(player.getSettings()).toMatchObject({ rate: 1.5, voice: 'b' });
	});

	it('closes the panel', async () => {
		const { q, posted } = setup();
		q<HTMLButtonElement>('.tts-close').click();
		expect(posted).toContainEqual({ type: 'close' });
	});

	it('swaps the engine when engine settings change, keeping it otherwise', async () => {
		const { send, q, synth } = setup();
		await send({ type: 'init', settings: settings() });
		const calls = synth.getVoices.mock.calls.length;
		await send({ type: 'settings', settings: settings({ rate: 1.25 }) });
		expect(synth.getVoices.mock.calls.length).toBe(calls); // voices not refetched
		await send({ type: 'settings', settings: settings({ engine: 'google' }) });
		expect([...q('.tts-voice').querySelectorAll('option')]).toHaveLength(1);
	});

	it('shows errors from the engine and clears them on play', async () => {
		const { send, q } = setup({ speechSynthesis: undefined });
		await send({ type: 'init', settings: settings() });
		await send({ type: 'load', title: 'n', sentences: ['A.'], autoplay: true });
		expect(q<HTMLElement>('.tts-error').hidden).toBe(false);
		expect(q('.tts-error').textContent).toBe(t.errorPrefix + t.unsupported);
		q<HTMLButtonElement>('.tts-play').click();
		await flush();
		expect(q('.tts-error').textContent).toContain(t.unsupported);
	});

	it('reports voice listing failures', async () => {
		const failing = {
			cancel: () => undefined,
			getVoices: () => {
				throw new Error('no voices');
			},
		};
		const { send, q } = setup({ speechSynthesis: failing as unknown as SpeechSynthesis });
		await send({ type: 'init', settings: settings() });
		expect(q('.tts-error').textContent).toContain('no voices');
	});

	it('stringifies non-Error voice failures', async () => {
		const failing = {
			cancel: () => undefined,
			getVoices: () => {
				throw 'weird';
			},
		};
		const { send, q } = setup({ speechSynthesis: failing as unknown as SpeechSynthesis });
		await send({ type: 'init', settings: settings() });
		expect(q('.tts-error').textContent).toContain('weird');
	});
});

describe('auto start', () => {
	afterEach(() => {
		delete (globalThis as { webviewApi?: unknown }).webviewApi;
		Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
	});

	const load = () => {
		jest.isolateModules(() => {
			require('./player');
		});
	};

	it('starts immediately when the document is ready', () => {
		document.body.innerHTML = '<div id="tts-root"></div>';
		const postMessage = jest.fn().mockResolvedValue(undefined);
		(globalThis as { webviewApi?: unknown }).webviewApi = { postMessage, onMessage: jest.fn() };
		load();
		expect(postMessage).toHaveBeenCalledWith({ type: 'ready' });
	});

	it('waits for DOMContentLoaded while loading', () => {
		document.body.innerHTML = '<div id="tts-root"></div>';
		Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
		const postMessage = jest.fn().mockResolvedValue(undefined);
		(globalThis as { webviewApi?: unknown }).webviewApi = { postMessage, onMessage: jest.fn() };
		load();
		expect(postMessage).not.toHaveBeenCalled();
		document.dispatchEvent(new Event('DOMContentLoaded'));
		expect(postMessage).toHaveBeenCalledWith({ type: 'ready' });
	});

	it('does nothing outside the Joplin webview', () => {
		expect(load).not.toThrow();
	});
});

describe('voice ordering', () => {
	it('sorts voices of the same language by name', async () => {
		const synth = {
			getVoices: () => [
				{ voiceURI: 'z', name: 'Zed', lang: 'en-US' },
				{ voiceURI: 'a', name: 'Amy', lang: 'en-US' },
			],
			cancel: jest.fn(),
		};
		const { send, q } = setup({ speechSynthesis: synth as unknown as SpeechSynthesis });
		await send({ type: 'init', settings: settings() });
		const names = [...q('.tts-voice').querySelectorAll('option')].map((o) => o.textContent);
		expect(names).toEqual([t.defaultVoice, 'Amy (en-US)', 'Zed (en-US)']);
	});
});
