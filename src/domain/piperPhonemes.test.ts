import { phonemeIds } from './piperPhonemes';

const map = { '^': [1], $: [2], _: [0], a: [10], b: [11, 12], ' ': [3] };

describe('phonemeIds', () => {
	it('frames the phonemes with begin and end markers and pads each one', () => {
		expect(phonemeIds(['a', 'b'], map)).toEqual([1, 10, 0, 11, 12, 0, 2]);
	});

	it('accepts one list per sentence, and code points instead of symbols', () => {
		expect(phonemeIds([['a'], [98, ' ']], map)).toEqual([1, 10, 0, 11, 12, 0, 3, 0, 2]);
	});

	it('splits multi-character items into symbols and skips the ones the voice does not know', () => {
		expect(phonemeIds(['ab', 'z'], map)).toEqual([1, 10, 0, 11, 12, 0, 2]);
	});

	it('works with a voice that has no markers or padding', () => {
		expect(phonemeIds(['a'], { a: [5] })).toEqual([5]);
		expect(phonemeIds([], {})).toEqual([]);
	});
});
