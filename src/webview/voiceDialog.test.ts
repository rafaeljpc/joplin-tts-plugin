import { DialogState } from '../application/piperDialog';
import { DIALOG_POLL_MS, DialogApiLike, initVoiceDialog } from './voiceDialog';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const state = (patch: Partial<DialogState> = {}): DialogState => ({
	voices: [
		{
			id: 'pt_BR-faber-medium',
			name: 'faber',
			language: 'pt_BR',
			quality: 'medium',
			sizeBytes: 63_000_000,
			installed: false,
		},
	],
	languages: ['pt_BR'],
	language: 'pt_BR',
	online: true,
	selected: '',
	downloading: null,
	error: null,
	notice: null,
	...patch,
});

function setup(language = 'en') {
	document.body.innerHTML = '<div id="tts-voice-root"></div>';
	const posted: unknown[] = [];
	const api: DialogApiLike = {
		postMessage: jest.fn(async (m) => {
			posted.push(m);
			return state();
		}),
	};
	const timers: (() => void)[] = [];
	const setTimer = ((fn: () => void, ms: number) => {
		expect(ms).toBe(DIALOG_POLL_MS);
		timers.push(fn);
		return 1;
	}) as unknown as typeof setInterval;
	initVoiceDialog(document, api, language, setTimer);
	const q = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
	return { posted, timers, q };
}

describe('voice dialog', () => {
	it('lists the voices as soon as it opens', async () => {
		const { posted, q } = setup();
		await flush();
		expect(posted).toEqual([{ type: 'piperPicker', request: { type: 'state' } }]);
		expect(q('.tts-picker-name').textContent).toBe('faber (pt-BR, medium)');
	});

	it('speaks the interface language', async () => {
		const { q } = setup('pt-BR');
		await flush();
		expect(q('.tts-picker-download').textContent).toBe('Baixar');
	});

	it('sends what the user does to the plugin and redraws with the answer', async () => {
		const { posted, q } = setup();
		await flush();
		q('.tts-picker-download').click();
		await flush();
		expect(posted).toContainEqual({
			type: 'piperPicker',
			request: { type: 'download', id: 'pt_BR-faber-medium' },
		});
	});

	it('asks for the download progress while it is open', async () => {
		const { posted, timers } = setup();
		await flush();
		timers[0]();
		await flush();
		expect(posted).toHaveLength(2);
	});

	it('needs its root element', () => {
		document.body.innerHTML = '';
		expect(() => initVoiceDialog(document, { postMessage: jest.fn() }, 'en')).toThrow(
			'Missing #tts-voice-root element',
		);
	});

	describe('auto start', () => {
		afterEach(() => {
			delete (globalThis as { webviewApi?: unknown }).webviewApi;
			Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
		});
		const load = () => {
			jest.isolateModules(() => {
				require('./voiceDialog');
			});
		};

		it('starts immediately when the document is ready', () => {
			document.body.innerHTML = '<div id="tts-voice-root"></div>';
			const postMessage = jest.fn().mockResolvedValue(state());
			(globalThis as { webviewApi?: unknown }).webviewApi = { postMessage };
			jest.useFakeTimers();
			try {
				load();
				expect(postMessage).toHaveBeenCalledWith({
					type: 'piperPicker',
					request: { type: 'state' },
				});
			} finally {
				jest.useRealTimers();
			}
		});

		it('waits for DOMContentLoaded while loading', () => {
			document.body.innerHTML = '<div id="tts-voice-root"></div>';
			Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
			const postMessage = jest.fn().mockResolvedValue(state());
			(globalThis as { webviewApi?: unknown }).webviewApi = { postMessage };
			jest.useFakeTimers();
			try {
				load();
				expect(postMessage).not.toHaveBeenCalled();
				document.dispatchEvent(new Event('DOMContentLoaded'));
				expect(postMessage).toHaveBeenCalled();
			} finally {
				jest.useRealTimers();
			}
		});

		it('does nothing outside the Joplin dialog', () => {
			expect(load).not.toThrow();
		});
	});
});
