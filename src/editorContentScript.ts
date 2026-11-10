/**
 * CodeMirror 6 content script. It reports the cursor position and the selected
 * text of the Markdown editor to the plugin, so reading can start at the
 * cursor or be limited to the selection.
 */

export interface EditorViewLike {
	dom: HTMLElement;
	state: {
		selection: { main: { from: number; to: number; head: number; empty: boolean } };
		doc: { lineAt(pos: number): { number: number; from: number } };
		sliceDoc(from: number, to: number): string;
	};
}

type Post = (message: unknown) => unknown;

const EVENTS = ['mouseup', 'keyup', 'focusin'];

export function trackEditor(view: EditorViewLike, post: Post): void {
	const report = () => {
		const { main } = view.state.selection;
		const line = view.state.doc.lineAt(main.head);
		const message = {
			source: 'editor',
			cursor: { line: line.number - 1, column: main.head - line.from },
			selection: main.empty ? '' : view.state.sliceDoc(main.from, main.to),
		};
		Promise.resolve(post(message)).catch(() => undefined);
	};
	for (const event of EVENTS) view.dom.addEventListener(event, report);
}

export default function (context: { postMessage: Post }) {
	return {
		plugin: (editorControl: { cm6?: EditorViewLike }) => {
			// The legacy CodeMirror 5 editor is not supported.
			if (!editorControl.cm6) return;
			trackEditor(editorControl.cm6, context.postMessage);
		},
	};
}
