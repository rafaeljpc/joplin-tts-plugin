import { chunkText } from './chunks';

describe('chunkText', () => {
	it('returns short text unchanged', () => {
		expect(chunkText('  hello world  ', 50)).toEqual(['hello world']);
	});

	it('returns nothing for blank text', () => {
		expect(chunkText('   ', 10)).toEqual([]);
	});

	it('prefers breaking after punctuation', () => {
		expect(chunkText('First part, second part continues here', 25)).toEqual([
			'First part,',
			'second part continues',
			'here',
		]);
	});

	it('breaks at spaces when there is no punctuation', () => {
		expect(chunkText('aaa bbb ccc ddd', 8)).toEqual(['aaa bbb', 'ccc ddd']);
	});

	it('hard cuts a single huge word', () => {
		expect(chunkText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
	});

	it('never exceeds the limit', () => {
		const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20);
		for (const chunk of chunkText(text, 60)) expect(chunk.length).toBeLessThanOrEqual(60);
	});
});
