import { markdownToPlainText } from './markdown';

describe('markdownToPlainText', () => {
	const cases: [string, string, string][] = [
		['headings', '# Title\n## Sub', 'Title\nSub'],
		[
			'emphasis',
			'**bold** and *it* and __b__ and _i_ and ~~s~~ and ==h==',
			'bold and it and b and i and s and h',
		],
		['links', 'See [docs](https://x.io/a) now', 'See docs now'],
		['images and joplin resources', 'a ![alt](:/abc123) b', 'a b'],
		['bare urls and autolinks', 'go https://x.io and <https://y.io> end', 'go and end'],
		['inline code', 'use `npm test` here', 'use npm test here'],
		['html tags', 'a <b>bold</b> <br/> c', 'a bold c'],
		[
			'bullets and numbers',
			'- one\n* two\n+ three\n1. four\n2) five',
			'one\ntwo\nthree\nfour\nfive',
		],
		['task lists', '- [ ] todo\n- [x] done', 'todo\ndone'],
		['blockquote', '> quoted\n>> nested', 'quoted\nnested'],
		['horizontal rules', 'a\n---\nb', 'a\n\nb'],
		['tables', '| a | b |\n| --- | :-: |\n| 1 | 2 |', 'a b\n\n1 2'],
		['footnotes and escapes', 'x[^1] \\*not bold\\*', 'x *not bold*'],
		['CRLF', 'a\r\nb\rc', 'a\nb\nc'],
		['collapses blank lines', 'a\n\n\n\n\nb', 'a\n\nb'],
	];

	it.each(cases)('handles %s', (_name, input, expected) => {
		expect(markdownToPlainText(input)).toBe(expected);
	});

	it('removes fenced code blocks', () => {
		expect(markdownToPlainText('before\n```js\nconst a = 1;\n```\nafter')).toBe('before\n\nafter');
		expect(markdownToPlainText('x\n~~~\ncode\n~~~\ny')).toBe('x\n\ny');
	});

	it('removes an unterminated fence until the end', () => {
		expect(markdownToPlainText('keep\n```\nnever closed\nmore')).toBe('keep');
	});

	it('returns an empty string for empty input', () => {
		expect(markdownToPlainText('')).toBe('');
	});
});
