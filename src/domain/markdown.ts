/** Escaped characters are mapped into the Private Use Area while passes run. */
const ESCAPE_BASE = 0xe000;

/** Replaces a matched block by as many line breaks as it contained, keeping line numbers. */
const keepLineBreaks = (match: string): string => '\n'.repeat(match.split('\n').length - 1);

/**
 * Converts Joplin Markdown into plain text suitable for speech, **one output
 * line per source line**. Blocks that are removed (code fences, rules, table
 * separators) leave empty lines behind, so line `i` of the result always
 * corresponds to line `i` of the Markdown. The reading plan relies on this to
 * map the editor cursor to a sentence.
 *
 * Intentionally dependency-free: a small set of regex passes is enough for
 * reading aloud, and keeps the plugin bundle tiny. No pass may match across a
 * line break, otherwise the line correspondence would be lost.
 */
export function markdownToLines(markdown: string): string[] {
	let text = markdown.replace(/\r\n?/g, '\n');

	// Fenced code blocks are not meaningful when spoken.
	text = text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, keepLineBreaks);
	// Unterminated fence: drop until the end of the document.
	text = text.replace(/^(```|~~~)[^\n]*\n[\s\S]*$/m, keepLineBreaks);
	// Protect backslash-escaped characters from the passes below (restored at the end).
	text = text.replace(/\\([\\`*_{}[\]()#+\-.!>|~])/g, (_, c: string) =>
		String.fromCharCode(ESCAPE_BASE + c.charCodeAt(0)),
	);
	// Joplin resource embeds / images: ![alt](:/id) or ![alt](url)
	text = text.replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, '');
	// Links: [label](target) -> label
	text = text.replace(/\[([^\]\n]*)\]\([^)\n]*\)/g, '$1');
	// Autolinks and bare URLs.
	text = text.replace(/<(https?:\/\/[^>\n]+)>/g, '');
	text = text.replace(/https?:\/\/\S+/g, '');
	// Inline HTML tags.
	text = text.replace(/<\/?[a-zA-Z][^>\n]*>/g, '');
	// Inline code: keep content, drop backticks.
	text = text.replace(/`([^`\n]*)`/g, '$1');
	// Horizontal rules.
	text = text.replace(/^[ \t]*([-*_])([ \t]*\1){2,}[ \t]*$/gm, '');
	// Table separator rows (they always contain at least one inner pipe) and pipes.
	text = text.replace(/^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*$/gm, '');
	text = text.replace(/\|/g, ' ');
	// Headings, blockquotes.
	text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '');
	text = text.replace(/^[ \t]*>+[ \t]?/gm, '');
	// Task list markers, then bullets and ordered list numbers.
	text = text.replace(/^([ \t]*)[-*+][ \t]+\[[ xX]\][ \t]+/gm, '$1');
	text = text.replace(/^[ \t]*[-*+][ \t]+/gm, '');
	text = text.replace(/^[ \t]*\d+[.)][ \t]+/gm, '');
	// Emphasis, strong, strikethrough, highlight.
	text = text.replace(/(\*\*|__)(.+?)\1/g, '$2');
	text = text.replace(/(\*|_)(.+?)\1/g, '$2');
	text = text.replace(/~~(.+?)~~/g, '$1');
	text = text.replace(/==(.+?)==/g, '$1');
	// Footnote references.
	text = text.replace(/\[\^[^\]\n]+\]/g, '');
	return text.split('\n').map((line) =>
		line
			.replace(/[ \t]+/g, ' ')
			.trim()
			// Restore escaped characters.
			.replace(/[-]/g, (c) => String.fromCharCode(c.charCodeAt(0) - ESCAPE_BASE)),
	);
}

/** Same conversion as {@link markdownToLines}, as a single block of text. */
export function markdownToPlainText(markdown: string): string {
	return markdownToLines(markdown)
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
