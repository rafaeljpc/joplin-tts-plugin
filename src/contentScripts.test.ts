import editorScript, {
	EditorViewLike,
	highlightRange,
	installHighlight,
	trackEditor,
} from './editorContentScript';
import viewerScript from './viewerContentScript';
import { pollHighlight, trackViewerSelection } from './webview/viewerSelection';

/** Stand-ins for the CodeMirror classes that Joplin provides at runtime. */
const mockCodeMirror = () => {
	const type = {} as { of?: (value: unknown) => unknown };
	type.of = (value) => ({ value, is: (t: unknown) => t === type });
	return {
		StateEffect: { define: () => type },
		StateField: { define: (config: unknown) => ({ config }) },
		Decoration: {
			none: 'NONE',
			mark: (spec: unknown) => ({ range: (from: number, to: number) => ({ spec, from, to }) }),
			set: (ranges: unknown[]) => ({ set: ranges }),
		},
		EditorView: {
			decorations: { from: (field: unknown) => ({ decorations: field }) },
			baseTheme: (theme: unknown) => ({ theme }),
			scrollIntoView: (pos: number, options: unknown) => ({ scroll: pos, options }),
		},
	};
};
jest.mock('@codemirror/state', () => mockCodeMirror(), { virtual: true });
jest.mock('@codemirror/view', () => mockCodeMirror(), { virtual: true });

/** A document with three lines of 10, 20 and 5 characters. */
const fakeDoc = () => {
	const lines = [
		{ from: 0, to: 10 },
		{ from: 11, to: 31 },
		{ from: 32, to: 37 },
	];
	return {
		lines: lines.length,
		line: (n: number) => lines[n - 1],
		lineAt: () => ({ number: 3, from: 5 }),
	};
};

const fakeView = (
	head: number,
	from: number,
	to: number,
): EditorViewLike & { dispatch: jest.Mock } => ({
	dom: document.createElement('div'),
	state: {
		selection: { main: { from, to, head, empty: from === to } },
		doc: fakeDoc(),
		sliceDoc: () => 'picked',
	},
	dispatch: jest.fn(),
});

const fakeControl = (view?: EditorViewLike) => ({
	cm6: view,
	addExtension: jest.fn(),
	registerCommand: jest.fn(),
});

describe('editor content script', () => {
	it('reports the cursor on every interaction', () => {
		const post = jest.fn().mockResolvedValue(undefined);
		const view = fakeView(12, 12, 12);
		trackEditor(view, post);
		view.dom.dispatchEvent(new Event('keyup'));
		view.dom.dispatchEvent(new Event('mouseup'));
		view.dom.dispatchEvent(new Event('focusin'));
		expect(post).toHaveBeenCalledTimes(3);
		expect(post).toHaveBeenCalledWith({
			source: 'editor',
			cursor: { line: 2, column: 7 },
			selection: '',
		});
	});

	it('includes the selected text and survives a failing post', () => {
		const post = jest.fn().mockRejectedValue(new Error('gone'));
		const view = fakeView(12, 8, 12);
		trackEditor(view, post);
		view.dom.dispatchEvent(new Event('mouseup'));
		expect(post).toHaveBeenCalledWith(expect.objectContaining({ selection: 'picked' }));
	});

	it('plugs into CodeMirror 6 only, tracking and highlighting', () => {
		const post = jest.fn().mockResolvedValue(undefined);
		const { plugin } = editorScript({ postMessage: post });
		const legacy = fakeControl();
		plugin(legacy);
		expect(legacy.addExtension).not.toHaveBeenCalled();

		const view = fakeView(1, 1, 1);
		const control = fakeControl(view);
		plugin(control);
		view.dom.dispatchEvent(new Event('keyup'));
		expect(post).toHaveBeenCalledTimes(1);
		expect(control.addExtension).toHaveBeenCalledTimes(1);
		expect(control.registerCommand).toHaveBeenCalledWith('tts.highlight', expect.any(Function));
	});
});

describe('highlightRange', () => {
	const doc = fakeDoc();

	it('maps columns to document positions, clamped to the line', () => {
		expect(highlightRange(doc, { line: 1, from: 2, to: 8 })).toEqual({ from: 13, to: 19 });
		expect(highlightRange(doc, { line: 1, from: 2, to: 99 })).toEqual({ from: 13, to: 31 });
		expect(highlightRange(doc, { line: 2, from: 99, to: 120 })).toBeNull();
	});

	it('uses the whole line when the columns are unknown', () => {
		expect(highlightRange(doc, { line: 0, from: null, to: null })).toEqual({ from: 0, to: 10 });
	});

	it('returns null when there is nothing to highlight', () => {
		expect(highlightRange(doc, null)).toBeNull();
		expect(highlightRange(doc, { line: -1, from: null, to: null })).toBeNull();
		expect(highlightRange(doc, { line: 3, from: 0, to: 1 })).toBeNull();
	});
});

describe('installHighlight', () => {
	const setup = () => {
		const view = fakeView(1, 1, 1);
		const control = fakeControl(view);
		installHighlight(control, view, mockCodeMirror() as never);
		const [field, theme] = control.addExtension.mock.calls[0][0] as [
			{ config: Record<string, (...args: unknown[]) => unknown> },
			{ theme: unknown },
		];
		const command = control.registerCommand.mock.calls[0][1] as (span: unknown) => void;
		return { view, field: field.config, theme, command };
	};

	it('adds the decoration field and the theme', () => {
		const { field, theme } = setup();
		expect(field.create()).toBe('NONE');
		expect(field.provide('f')).toEqual({ decorations: 'f' });
		expect(JSON.stringify(theme)).toContain('tts-current-sentence');
	});

	it('highlights a sentence and scrolls to it', () => {
		const { view, command } = setup();
		command({ line: 1, from: 2, to: 8 });
		const { effects } = view.dispatch.mock.calls[0][0] as { effects: { value?: unknown }[] };
		expect(effects).toHaveLength(2);
		expect(effects[0].value).toEqual({
			set: [{ spec: { class: 'tts-current-sentence' }, from: 13, to: 19 }],
		});
		expect(effects[1]).toEqual({ scroll: 13, options: { y: 'nearest' } });
	});

	it('clears the highlight', () => {
		const { view, command } = setup();
		command(null);
		const { effects } = view.dispatch.mock.calls[0][0] as { effects: { value?: unknown }[] };
		expect(effects).toHaveLength(1);
		expect(effects[0].value).toBe('NONE');
	});

	it('keeps decorations in place while editing and swaps them on the effect', () => {
		const { view, field, command } = setup();
		const map = jest.fn(() => 'MAPPED');
		expect(field.update({ map }, { changes: 'c', effects: [] })).toBe('MAPPED');

		command(null);
		const { effects } = view.dispatch.mock.calls[0][0] as { effects: unknown[] };
		expect(field.update({ map }, { changes: 'c', effects })).toBe('NONE');
	});
});

describe('viewer content script', () => {
	it('only contributes the selection tracking asset', () => {
		const script = viewerScript();
		expect(script.plugin()).toBeUndefined();
		expect(script.assets()).toEqual([{ name: './webview/viewerSelection.js' }]);
	});
});

describe('viewer selection tracking', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it('debounces selection changes and reports the selected text', () => {
		const api = { postMessage: jest.fn().mockResolvedValue(undefined) };
		trackViewerSelection(document, api, 100);
		jest.spyOn(document, 'getSelection').mockReturnValue({ toString: () => 'hello' } as Selection);
		document.dispatchEvent(new Event('selectionchange'));
		document.dispatchEvent(new Event('selectionchange'));
		jest.advanceTimersByTime(100);
		expect(api.postMessage).toHaveBeenCalledTimes(1);
		expect(api.postMessage).toHaveBeenCalledWith('tts.viewer', {
			source: 'viewer',
			selection: 'hello',
		});
	});

	it('reports an empty selection and ignores post failures', () => {
		const api = { postMessage: jest.fn().mockRejectedValue(new Error('x')) };
		trackViewerSelection(document, api);
		jest.spyOn(document, 'getSelection').mockReturnValue(null);
		document.dispatchEvent(new Event('selectionchange'));
		jest.advanceTimersByTime(150);
		expect(api.postMessage).toHaveBeenCalledWith('tts.viewer', { source: 'viewer', selection: '' });
	});
});

describe('viewer highlight polling', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it('asks for the highlight at an interval and shows the reply', async () => {
		const api = { postMessage: jest.fn().mockResolvedValue({ highlight: 'Read me.' }) };
		const show = jest.fn();
		pollHighlight(api, show, 100);
		await jest.advanceTimersByTimeAsync(100);
		expect(api.postMessage).toHaveBeenCalledWith('tts.viewer', { type: 'poll' });
		expect(show).toHaveBeenCalledWith('Read me.');
	});

	it('shows nothing for an empty reply and survives failures', async () => {
		const api = {
			postMessage: jest
				.fn()
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error('gone')),
		};
		const show = jest.fn();
		pollHighlight(api, show, 100);
		await jest.advanceTimersByTimeAsync(100);
		expect(show).toHaveBeenLastCalledWith(null);
		await jest.advanceTimersByTimeAsync(100);
		expect(api.postMessage).toHaveBeenCalledTimes(2);
	});

	it('never overlaps requests', async () => {
		let release: (value: unknown) => void = () => undefined;
		const api = { postMessage: jest.fn(() => new Promise((resolve) => (release = resolve))) };
		pollHighlight(api, jest.fn(), 100);
		await jest.advanceTimersByTimeAsync(350);
		expect(api.postMessage).toHaveBeenCalledTimes(1);
		release({ highlight: null });
		await jest.advanceTimersByTimeAsync(100);
		expect(api.postMessage).toHaveBeenCalledTimes(2);
	});
});

describe('viewer selection auto-start', () => {
	afterEach(() => {
		delete (globalThis as { webviewApi?: unknown }).webviewApi;
		delete (window as { Highlight?: unknown }).Highlight;
		jest.resetModules();
		jest.useRealTimers();
	});

	it('starts tracking when loaded inside Joplin', () => {
		const api = { postMessage: jest.fn().mockResolvedValue(undefined) };
		(globalThis as { webviewApi?: unknown }).webviewApi = api;
		const spy = jest.spyOn(document, 'addEventListener');
		jest.isolateModules(() => {
			require('./webview/viewerSelection');
		});
		expect(spy).toHaveBeenCalledWith('selectionchange', expect.any(Function));
		spy.mockRestore();
	});

	it('also polls for the highlight when the browser supports it', () => {
		jest.useFakeTimers();
		const api = { postMessage: jest.fn().mockResolvedValue(undefined) };
		(globalThis as { webviewApi?: unknown }).webviewApi = api;
		(window as unknown as { CSS: unknown }).CSS = {
			highlights: { set: jest.fn(), delete: jest.fn() },
		};
		(window as unknown as { Highlight: unknown }).Highlight = class {};
		jest.isolateModules(() => {
			require('./webview/viewerSelection');
		});
		jest.advanceTimersByTime(500);
		expect(api.postMessage).toHaveBeenCalledWith('tts.viewer', { type: 'poll' });
	});
});
