/**
 * Splits text into pieces of at most `max` characters, preferring to break
 * after punctuation, then at spaces. Used by engines with a request size limit.
 */
export function chunkText(text: string, max: number): string[] {
	const chunks: string[] = [];
	let rest = text.trim();
	while (rest.length > max) {
		const window = rest.slice(0, max + 1);
		let cut = Math.max(
			window.lastIndexOf(', '),
			window.lastIndexOf('; '),
			window.lastIndexOf(': '),
			window.lastIndexOf('. '),
		);
		if (cut > 0) cut += 1; // keep the punctuation mark, drop the space afterwards
		if (cut <= 0) cut = window.lastIndexOf(' ');
		if (cut <= 0) cut = max; // a single huge word: hard cut
		chunks.push(rest.slice(0, cut).trim());
		rest = rest.slice(cut).trim();
	}
	if (rest) chunks.push(rest);
	return chunks;
}
