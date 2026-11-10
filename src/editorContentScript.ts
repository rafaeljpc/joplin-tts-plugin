/**
 * CodeMirror 6 content script. It reports the cursor position and the selected
 * text of the Markdown editor to the plugin (so reading can start at the cursor
 * or be limited to the selection) and highlights the sentence being read.
 */
import { EDITOR_HIGHLIGHT_COMMAND } from './application/ids';
import type { HighlightSpan } from './domain/plan';

export interface EditorViewLike {
	dom: HTMLElement;
	state: {
		selection: { main: { from: number; to: number; head: number; empty: boolean } };
		doc: {
			lines: number;
			line(number: number): { from: number; to: number };
			lineAt(pos: number): { number: number; from: number };
		};
		sliceDoc(from: number, to: number): string;
	};
	dispatch(spec: { effects: unknown[] }): void;
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

/** Document range of a highlight, clamped to its line; null when the line is gone. */
export function highlightRange(
	doc: EditorViewLike['state']['doc'],
	span: HighlightSpan | null,
): { from: number; to: number } | null {
	if (!span || span.line < 0 || span.line >= doc.lines) return null;
	const line = doc.line(span.line + 1);
	const from = span.from === null ? line.from : Math.min(line.to, line.from + span.from);
	const to = span.to === null ? line.to : Math.min(line.to, line.from + span.to);
	return to > from ? { from, to } : null;
}

/** The CodeMirror pieces the highlight needs; they come from Joplin at runtime. */
interface CodeMirrorLibs {
	StateEffect: { define<T>(): { of(value: T): unknown; is?: unknown } };
	StateField: { define<T>(config: unknown): T };
	Decoration: {
		none: unknown;
		mark(spec: { class: string }): { range(from: number, to: number): unknown };
		set(ranges: unknown[]): unknown;
	};
	EditorView: {
		decorations: { from(field: unknown): unknown };
		baseTheme(spec: Record<string, Record<string, string>>): unknown;
		scrollIntoView(pos: number, options: { y: string }): unknown;
	};
}

interface EditorControl {
	cm6?: EditorViewLike;
	addExtension(extension: unknown): void;
	registerCommand(name: string, callback: (...args: never[]) => unknown): void;
}

/** Sets up the highlight decoration and the command the plugin calls to move it. */
export function installHighlight(
	control: EditorControl,
	view: EditorViewLike,
	libs: CodeMirrorLibs,
): void {
	const { StateEffect, StateField, Decoration, EditorView } = libs;
	const setHighlight = StateEffect.define<unknown>();
	const field = StateField.define({
		create: () => Decoration.none,
		update(decorations: { map(changes: unknown): unknown }, transaction: never) {
			const { changes, effects } = transaction as {
				changes: unknown;
				effects: { is(type: unknown): boolean; value: unknown }[];
			};
			let result = decorations.map(changes);
			for (const effect of effects) if (effect.is(setHighlight)) result = effect.value;
			return result;
		},
		provide: (f: unknown) => EditorView.decorations.from(f),
	});
	const theme = EditorView.baseTheme({
		'.tts-current-sentence': { backgroundColor: 'rgba(255, 213, 0, 0.4)' },
	});
	control.addExtension([field, theme]);

	control.registerCommand(EDITOR_HIGHLIGHT_COMMAND, (span: HighlightSpan | null) => {
		const range = highlightRange(view.state.doc, span);
		const value = range
			? Decoration.set([
					Decoration.mark({ class: 'tts-current-sentence' }).range(range.from, range.to),
				])
			: Decoration.none;
		const effects: unknown[] = [setHighlight.of(value)];
		if (range) effects.push(EditorView.scrollIntoView(range.from, { y: 'nearest' }));
		view.dispatch({ effects });
	});
}

export default function (context: { postMessage: Post }) {
	return {
		plugin: (editorControl: EditorControl) => {
			// The legacy CodeMirror 5 editor is not supported.
			if (!editorControl.cm6) return;
			trackEditor(editorControl.cm6, context.postMessage);
			// Provided by Joplin to content scripts (see "externals" in webpack.config.js).
			const libs = {
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				...require('@codemirror/state'),
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				...require('@codemirror/view'),
			};
			installHighlight(editorControl, editorControl.cm6, libs);
		},
	};
}
