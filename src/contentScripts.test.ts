import editorScript, { EditorViewLike, trackEditor } from './editorContentScript';
import viewerScript from './viewerContentScript';
import { trackViewerSelection } from './webview/viewerSelection';

const fakeView = (head: number, from: number, to: number, lineStart = 5): EditorViewLike => {
	const dom = document.createElement('div');
	return {
		dom,
		state: {
			selection: { main: { from, to, head, empty: from === to } },
			doc: { lineAt: () => ({ number: 3, from: lineStart }) },
			sliceDoc: () => 'picked',
		},
	};
};

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

	it('plugs into CodeMirror 6 only', () => {
		const post = jest.fn().mockResolvedValue(undefined);
		const { plugin } = editorScript({ postMessage: post });
		plugin({});
		const view = fakeView(1, 1, 1);
		plugin({ cm6: view });
		view.dom.dispatchEvent(new Event('keyup'));
		expect(post).toHaveBeenCalledTimes(1);
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

describe('viewer selection auto-start', () => {
	afterEach(() => {
		delete (globalThis as { webviewApi?: unknown }).webviewApi;
		jest.resetModules();
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
});
