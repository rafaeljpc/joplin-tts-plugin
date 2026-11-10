import { format, getStrings } from './i18n';

describe('i18n', () => {
	it('picks pt for pt-BR and pt_PT', () => {
		expect(getStrings('pt-BR').play).toBe('Tocar');
		expect(getStrings('pt_PT').play).toBe('Tocar');
	});

	it('falls back to English', () => {
		expect(getStrings('fr-FR').play).toBe('Play');
		expect(getStrings(undefined).play).toBe('Play');
	});

	it('formats placeholders', () => {
		expect(format('Sentence {0} of {1}', 2, 9)).toBe('Sentence 2 of 9');
		expect(format('{0}{2}', 'a')).toBe('a');
	});
});
