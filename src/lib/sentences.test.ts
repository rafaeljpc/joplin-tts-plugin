import { noteToSentences, splitSentences } from './sentences';

describe('splitSentences (Intl.Segmenter)', () => {
	it('splits on sentence punctuation', () => {
		expect(splitSentences('Hello world. How are you? Fine!')).toEqual([
			'Hello world.',
			'How are you?',
			'Fine!',
		]);
	});

	it('treats every line as a boundary', () => {
		expect(splitSentences('Heading\n\nItem one\nItem two.')).toEqual([
			'Heading',
			'Item one',
			'Item two.',
		]);
	});

	it('drops fragments without letters or digits', () => {
		expect(splitSentences('... \n!!!\nOk.')).toEqual(['Ok.']);
	});

	it('keeps accented text and digits', () => {
		expect(splitSentences('Olá, mundo. Foi bom em 2024.', 'pt-BR')).toEqual([
			'Olá, mundo.',
			'Foi bom em 2024.',
		]);
	});

	it('returns an empty list for blank input', () => {
		expect(splitSentences('  \n ')).toEqual([]);
	});
});

describe('splitSentences (regex fallback)', () => {
	const intl = Intl as unknown as { Segmenter?: unknown };
	const original = intl.Segmenter;

	beforeAll(() => {
		intl.Segmenter = undefined;
	});
	afterAll(() => {
		intl.Segmenter = original;
	});

	it('splits on punctuation without Intl.Segmenter', () => {
		expect(splitSentences('One. Two! Three? Four')).toEqual(['One.', 'Two!', 'Three?', 'Four']);
	});

	it('handles trailing quotes and ellipsis', () => {
		expect(splitSentences('He said "go." Then left…')).toEqual(['He said "go."', 'Then left…']);
	});
});

describe('noteToSentences', () => {
	it('prepends the title when requested', () => {
		expect(noteToSentences('My note', 'Body here.', true)).toEqual(['My note.', 'Body here.']);
	});

	it('does not double the title punctuation', () => {
		expect(noteToSentences('Question?', 'Body.', true)).toEqual(['Question.', 'Body.']);
	});

	it('omits the title when disabled', () => {
		expect(noteToSentences('My note', 'Body here.', false)).toEqual(['Body here.']);
	});
});
