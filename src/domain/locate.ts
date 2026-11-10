/** Columns of a sentence inside its raw Markdown line; `to` is exclusive. */
export interface Span {
	from: number;
	to: number;
}

/** Characters that Markdown adds around text and that are not spoken. */
const MARKUP = '*_~=`\\#>[]!|';

const isSpace = (char: string): boolean => /\s/.test(char) || char === '|';

/**
 * Length of the unspoken Markdown construct at `index` (image, link target,
 * bare URL, HTML tag, footnote mark or a single markup character), or 0.
 */
function unspokenLength(raw: string, index: number): number {
	if (raw.startsWith('![', index)) {
		const close = raw.indexOf('](', index);
		const end = close === -1 ? -1 : raw.indexOf(')', close);
		if (end !== -1) return end + 1 - index;
	}
	if (raw.startsWith('](', index)) {
		const end = raw.indexOf(')', index);
		if (end !== -1) return end + 1 - index;
	}
	const rest = raw.slice(index);
	const construct = /^(https?:\/\/\S+|<\/?[a-zA-Z][^>]*>|\[\^[^\]]+\])/.exec(rest);
	if (construct) return construct[0].length;
	// Spaces left behind by a removed construct are skipped as well.
	return MARKUP.includes(raw[index]) || isSpace(raw[index]) ? 1 : 0;
}

/** End of the match of `text` starting exactly at `start`, or null. */
function matchAt(raw: string, start: number, text: string): number | null {
	let k = start;
	let j = 0;
	while (j < text.length) {
		if (k >= raw.length) return null;
		if (text[j] === ' ' && isSpace(raw[k])) {
			while (k < raw.length && isSpace(raw[k])) k++;
			j++;
		} else if (text[j] !== ' ' && raw[k] === text[j]) {
			k++;
			j++;
		} else {
			const skip = unspokenLength(raw, k);
			if (skip === 0) return null;
			k += skip;
		}
	}
	return k;
}

/**
 * Finds where a spoken sentence (plain text) came from inside the Markdown
 * line it was extracted from, skipping the markup that was removed on the way
 * (`**`, link targets, images, ...). `fromColumn` lets the caller locate the
 * sentences of one line in order, so repeated sentences map to distinct spans.
 * Returns null when the sentence cannot be aligned with the line.
 */
export function locateInLine(raw: string, sentence: string, fromColumn = 0): Span | null {
	const text = sentence.replace(/\s+/g, ' ').trim();
	if (!text) return null;
	for (let i = raw.indexOf(text[0], fromColumn); i !== -1; i = raw.indexOf(text[0], i + 1)) {
		const to = matchAt(raw, i, text);
		if (to !== null) return { from: i, to };
	}
	return null;
}
