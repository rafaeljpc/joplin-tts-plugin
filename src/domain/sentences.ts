type SegmenterCtor = new (
	locale?: string,
	options?: { granularity: 'sentence' },
) => { segment(input: string): Iterable<{ segment: string }> };

const getSegmenter = (): SegmenterCtor | undefined =>
	(Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;

/** Regex fallback for runtimes without Intl.Segmenter. */
function splitWithRegex(text: string): string[] {
	return Array.from(text.matchAll(/[^.!?…\n]+(?:[.!?…]+["')\]]*|$)|[.!?…]+/g), (m) => m[0]);
}

function splitWithSegmenter(text: string, Segmenter: SegmenterCtor, locale?: string): string[] {
	const segmenter = new Segmenter(locale, { granularity: 'sentence' });
	return Array.from(segmenter.segment(text), (s) => s.segment);
}

/**
 * Splits text into sentences. Paragraphs/lines are always sentence boundaries,
 * so headings and list items (which usually lack a final period) are read as
 * separate units.
 */
export function splitSentences(text: string, locale?: string): string[] {
	const Segmenter = getSegmenter();
	const result: string[] = [];
	for (const block of text.split(/\n+/)) {
		if (!block.trim()) continue;
		const parts = Segmenter ? splitWithSegmenter(block, Segmenter, locale) : splitWithRegex(block);
		for (const part of parts) {
			const sentence = part.replace(/\s+/g, ' ').trim();
			// Skip fragments with no letter or digit (e.g. stray punctuation).
			if (/[\p{L}\p{N}]/u.test(sentence)) result.push(sentence);
		}
	}
	return result;
}

/** Builds the list of sentences for a note. */
export function noteToSentences(
	title: string,
	plainBody: string,
	readTitle: boolean,
	locale?: string,
): string[] {
	const sentences = splitSentences(plainBody, locale);
	if (readTitle) {
		const titleSentences = splitSentences(title.replace(/[.!?…]*$/, '.'), locale);
		return [...titleSentences, ...sentences];
	}
	return sentences;
}
