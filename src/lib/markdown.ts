/** Escaped characters are mapped into the Private Use Area while passes run. */
const ESCAPE_BASE = 0xe000;

/**
 * Converts Joplin Markdown into plain text suitable for speech.
 * Intentionally dependency-free: a small set of regex passes is enough for
 * reading aloud, and keeps the plugin bundle tiny.
 */
export function markdownToPlainText(markdown: string): string {
	let text = markdown.replace(/\r\n?/g, '\n');

	// Fenced code blocks are not meaningful when spoken.
	text = text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '');
	// Unterminated fence: drop until the end of the document.
	text = text.replace(/^(```|~~~)[^\n]*\n[\s\S]*$/m, '');
	// Protect backslash-escaped characters from the passes below (restored at the end).
	text = text.replace(/\\([\\`*_{}[\]()#+\-.!>|~])/g, (_, c: string) =>
		String.fromCharCode(ESCAPE_BASE + c.charCodeAt(0)),
	);
	// Joplin resource embeds / images: ![alt](:/id) or ![alt](url)
	text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
	// Links: [label](target) -> label
	text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
	// Autolinks and bare URLs.
	text = text.replace(/<(https?:\/\/[^>]+)>/g, '');
	text = text.replace(/https?:\/\/\S+/g, '');
	// Inline HTML tags.
	text = text.replace(/<\/?[a-zA-Z][^>]*>/g, '');
	// Inline code: keep content, drop backticks.
	text = text.replace(/`([^`]*)`/g, '$1');
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
	text = text.replace(/\[\^[^\]]+\]/g, '');
	// Whitespace normalization: keep paragraph breaks, collapse the rest.
	text = text
		.split('\n')
		.map((line) => line.replace(/[ \t]+/g, ' ').trim())
		.join('\n');
	text = text.replace(/\n{3,}/g, '\n\n');
	// Restore escaped characters.
	text = text.replace(/[-]/g, (c) => String.fromCharCode(c.charCodeAt(0) - ESCAPE_BASE));
	return text.trim();
}
