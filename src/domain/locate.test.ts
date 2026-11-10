import { locateInLine } from './locate';

const slice = (raw: string, sentence: string, from = 0) => {
	const span = locateInLine(raw, sentence, from);
	return span && raw.slice(span.from, span.to);
};

describe('locateInLine', () => {
	it('finds a plain sentence', () => {
		expect(locateInLine('Hello world. Bye.', 'Bye.')).toEqual({ from: 13, to: 17 });
	});

	it('skips markup that was removed from the spoken text', () => {
		expect(slice('# **Hello** _brave_ ~~old~~ world.', 'Hello brave old world.')).toBe(
			'Hello** _brave_ ~~old~~ world.',
		);
		expect(slice('- [ ] Buy `milk` today.', 'Buy milk today.')).toBe('Buy `milk` today.');
		expect(slice('Escaped \\*star\\* here.', 'Escaped *star* here.')).toBe(
			'Escaped \\*star\\* here.',
		);
	});

	it('skips link targets, images, URLs, tags and footnote marks', () => {
		expect(slice('See [the docs](https://x.io/a) now.', 'See the docs now.')).toBe(
			'See [the docs](https://x.io/a) now.',
		);
		expect(slice('A ![logo](:/abc) picture.', 'A picture.')).toBe('A ![logo](:/abc) picture.');
		expect(slice('Go to https://x.io/a today.', 'Go to today.')).toBe(
			'Go to https://x.io/a today.',
		);
		expect(slice('Some <b>bold</b> text.', 'Some bold text.')).toBe('Some <b>bold</b> text.');
		expect(slice('Claim[^1] made.', 'Claim made.')).toBe('Claim[^1] made.');
	});

	it('treats table pipes and runs of spaces as whitespace', () => {
		expect(slice('| one |  two\t|', 'one two')).toBe('one |  two');
	});

	it('locates repeated sentences one after another', () => {
		const raw = 'Again. Again. Again.';
		const first = locateInLine(raw, 'Again.', 0);
		const second = locateInLine(raw, 'Again.', first?.to);
		expect(first).toEqual({ from: 0, to: 6 });
		expect(second).toEqual({ from: 7, to: 13 });
	});

	it('retries later occurrences of the first character', () => {
		expect(slice('Hello. Help me.', 'Help me.')).toBe('Help me.');
	});

	it('returns null when the sentence is not in the line', () => {
		expect(locateInLine('Hello world.', 'Goodbye.')).toBeNull();
		expect(locateInLine('Hello', 'Hello world.')).toBeNull();
		expect(locateInLine('Hello world.', '   ')).toBeNull();
		// An unterminated image or link target is not skippable.
		expect(locateInLine('A ![x](oops picture.', 'A picture.')).toBeNull();
		expect(locateInLine('See](oops now.', 'See now.')).toBeNull();
		expect(locateInLine('A ![x picture.', 'A picture.')).toBeNull();
	});
});
