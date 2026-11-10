/** Name of the CSS highlight, matched by the `::highlight()` rule below. */
const HIGHLIGHT_NAME = 'tts-current';

const STYLE = `::highlight(${HIGHLIGHT_NAME}) { background-color: rgba(255, 213, 0, 0.4); }`;

/** The CSS Custom Highlight API pieces; missing in browsers that lack it. */
export interface HighlightEnv {
	highlights: { set(name: string, highlight: unknown): void; delete(name: string): void };
	createHighlight(range: Range): unknown;
}

export interface ViewerHighlighter {
	/** Highlights `text` in the rendered note; null clears the highlight. */
	show(text: string | null): void;
}

/** Returns the Highlight API of the window, or null when it is not available. */
export function detectHighlightEnv(win: {
	CSS?: { highlights?: HighlightEnv['highlights'] };
	Highlight?: new (...ranges: Range[]) => unknown;
}): HighlightEnv | null {
	const highlights = win.CSS?.highlights;
	const HighlightClass = win.Highlight;
	if (!highlights || !HighlightClass) return null;
	return { highlights, createHighlight: (range) => new HighlightClass(range) };
}

/**
 * Finds `text` in the visible text of the document, ignoring differences in
 * whitespace and the element boundaries (bold, links, ...) it may cross.
 */
export function findTextRange(doc: Document, text: string): Range | null {
	const needle = text.replace(/\s+/g, ' ').trim();
	if (!needle || !doc.body) return null;

	let haystack = '';
	const nodes: Text[] = [];
	const offsets: number[] = [];
	const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const parent = (node.parentNode as Element).tagName;
		if (parent === 'SCRIPT' || parent === 'STYLE') continue;
		const value = (node as Text).data;
		for (let i = 0; i < value.length; i++) {
			const isSpace = /\s/.test(value[i]);
			if (isSpace && haystack.endsWith(' ')) continue;
			haystack += isSpace ? ' ' : value[i];
			nodes.push(node as Text);
			offsets.push(i);
		}
	}

	const start = haystack.indexOf(needle);
	if (start === -1) return null;
	const last = start + needle.length - 1;
	const range = doc.createRange();
	range.setStart(nodes[start], offsets[start]);
	range.setEnd(nodes[last], offsets[last] + 1);
	return range;
}

/** Highlights sentences in the rendered viewer without touching its DOM. */
export function createViewerHighlighter(doc: Document, env: HighlightEnv): ViewerHighlighter {
	const style = doc.createElement('style');
	style.textContent = STYLE;
	doc.head.append(style);

	let shown: string | null = null;
	return {
		show(text) {
			if (text === shown) return;
			shown = text;
			const range = text === null ? null : findTextRange(doc, text);
			if (!range) {
				env.highlights.delete(HIGHLIGHT_NAME);
				return;
			}
			env.highlights.set(HIGHLIGHT_NAME, env.createHighlight(range));
			(range.startContainer.parentNode as Element).scrollIntoView({ block: 'nearest' });
		},
	};
}
