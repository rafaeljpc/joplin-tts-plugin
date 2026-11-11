/** Maps a phoneme symbol to its ids, as in the `phoneme_id_map` of a voice. */
export type PhonemeIdMap = Record<string, number[]>;

const BOS = '^';
const EOS = '$';
const PAD = '_';

/** Every leaf of a nested list, in order. */
function leaves(value: unknown): unknown[] {
	return Array.isArray(value) ? value.flatMap(leaves) : [value];
}

/**
 * The ids a voice expects for the phonemes eSpeak produced, the way Piper does it:
 * begin-of-sentence, each phoneme followed by padding, end-of-sentence. Phonemes
 * the voice does not know are skipped. `phonemes` may be nested (one list per
 * sentence) and hold symbols or Unicode code points.
 */
export function phonemeIds(phonemes: unknown, map: PhonemeIdMap): number[] {
	const ids = [...(map[BOS] ?? [])];
	for (const item of leaves(phonemes)) {
		const symbols = typeof item === 'number' ? String.fromCodePoint(item) : String(item);
		for (const symbol of Array.from(symbols)) {
			if (map[symbol]) ids.push(...map[symbol], ...(map[PAD] ?? []));
		}
	}
	ids.push(...(map[EOS] ?? []));
	return ids;
}
