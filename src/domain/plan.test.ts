import { markdownToLines } from './markdown';
import {
	buildSentences,
	parseInteraction,
	planReading,
	startIndexForCursor,
	Sentence,
} from './plan';

const options = { readTitle: true, language: 'en' };
const note = {
	title: 'My note',
	body: '# Heading\n\nFirst one. Second one.\n\n```\ncode\n```\n\n- item **bold**',
};

describe('markdownToLines', () => {
	it('keeps one output line per source line, even for removed blocks', () => {
		const source = note.body;
		const lines = markdownToLines(source);
		expect(lines).toHaveLength(source.split('\n').length);
		expect(lines[0]).toBe('Heading');
		expect(lines[2]).toBe('First one. Second one.');
		expect(lines.slice(4, 7)).toEqual(['', '', '']);
		expect(lines[8]).toBe('item bold');
	});
});

describe('parseInteraction', () => {
	it('accepts editor and viewer messages', () => {
		expect(
			parseInteraction({ source: 'editor', cursor: { line: 1, column: 2 }, selection: 'x' }),
		).toEqual({ source: 'editor', cursor: { line: 1, column: 2 }, selection: 'x' });
		expect(parseInteraction({ source: 'viewer', selection: 'y' })).toEqual({
			source: 'viewer',
			selection: 'y',
		});
		expect(parseInteraction({ source: 'viewer' })).toEqual({ source: 'viewer', selection: '' });
	});

	it('rejects anything else', () => {
		expect(parseInteraction(null)).toBeNull();
		expect(parseInteraction('x')).toBeNull();
		expect(parseInteraction({ source: 'other' })).toBeNull();
		expect(parseInteraction({ source: 'editor' })).toBeNull();
		expect(parseInteraction({ source: 'editor', cursor: { line: 1 } })).toBeNull();
		expect(parseInteraction({ source: 'editor', cursor: { line: 'a', column: 1 } })).toBeNull();
	});
});

describe('buildSentences', () => {
	it('tags sentences with their line and the title with -1', () => {
		const result = buildSentences(note, options);
		expect(result.map((s) => [s.text, s.line])).toEqual([
			['My note.', -1],
			['Heading', 0],
			['First one.', 2],
			['Second one.', 2],
			['item bold', 8],
		]);
	});

	it('skips the title when disabled', () => {
		expect(buildSentences(note, { ...options, readTitle: false })[0].line).toBe(0);
	});
});

describe('startIndexForCursor', () => {
	const sentences: Sentence[] = [
		{ text: 'Aaaa.', line: 0 },
		{ text: 'Bbbb.', line: 0 },
		{ text: 'Cccc.', line: 3 },
	];

	it('returns 0 when there is nothing to read', () => {
		expect(startIndexForCursor([], { line: 0, column: 0 }, 0)).toBe(0);
	});

	it('picks the sentence on the cursor line proportionally to the column', () => {
		expect(startIndexForCursor(sentences, { line: 0, column: 1 }, 10)).toBe(0);
		expect(startIndexForCursor(sentences, { line: 0, column: 8 }, 10)).toBe(1);
		expect(startIndexForCursor(sentences, { line: 0, column: 50 }, 10)).toBe(1);
		expect(startIndexForCursor(sentences, { line: 0, column: 0 }, 0)).toBe(0);
	});

	it('moves to the next sentence from a line without speech, or the last one', () => {
		expect(startIndexForCursor(sentences, { line: 1, column: 0 }, 0)).toBe(2);
		expect(startIndexForCursor(sentences, { line: 9, column: 0 }, 0)).toBe(2);
	});
});

describe('planReading', () => {
	it('reads the whole note from the start without any interaction', () => {
		const plan = planReading(note, options, null);
		expect(plan.startIndex).toBe(0);
		expect(plan.sentences).toHaveLength(5);
	});

	it('starts at the editor cursor', () => {
		const plan = planReading(note, options, {
			source: 'editor',
			cursor: { line: 2, column: 20 },
			selection: '',
		});
		expect(plan.sentences[plan.startIndex]).toBe('Second one.');
	});

	it('tolerates a cursor line past the end of the note', () => {
		const plan = planReading(note, options, {
			source: 'editor',
			cursor: { line: 99, column: 0 },
			selection: '',
		});
		expect(plan.startIndex).toBe(plan.sentences.length - 1);
	});

	it('reads only an editor selection, converted from Markdown', () => {
		const plan = planReading(note, options, {
			source: 'editor',
			cursor: { line: 0, column: 0 },
			selection: '**Bold** text. More.',
		});
		expect(plan).toEqual({ sentences: ['Bold text.', 'More.'], startIndex: 0 });
	});

	it('reads only a viewer selection as is', () => {
		expect(planReading(note, options, { source: 'viewer', selection: ' Chosen bit. ' })).toEqual({
			sentences: ['Chosen bit.'],
			startIndex: 0,
		});
	});

	it('falls back to the cursor when the selection has nothing speakable', () => {
		const plan = planReading(note, options, {
			source: 'editor',
			cursor: { line: 2, column: 0 },
			selection: '```',
		});
		expect(plan.sentences).toHaveLength(5);
		expect(plan.sentences[plan.startIndex]).toBe('First one.');
	});

	it('ignores a blank viewer selection', () => {
		expect(planReading(note, options, { source: 'viewer', selection: '  ' }).startIndex).toBe(0);
	});
});
