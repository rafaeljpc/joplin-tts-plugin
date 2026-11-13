import { DEFAULT_SETTINGS } from './settings';
import { languageOptions } from './languages';

describe('languageOptions', () => {
	it('lists labelled codes, sorted by name, including the default', () => {
		const options = languageOptions();
		expect(options['pt-BR']).toBe('Portuguese (Brazil) — pt-BR');
		expect(options[DEFAULT_SETTINGS.language]).toBeDefined();
		const labels = Object.values(options);
		expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
	});

	it('keeps a value that is not in the list as a custom option', () => {
		expect(languageOptions('pt').pt).toBe('Custom — pt');
		expect(languageOptions('pt-BR')['pt-BR']).toBe('Portuguese (Brazil) — pt-BR');
	});

	it('ignores empty or non-string values', () => {
		const size = Object.keys(languageOptions()).length;
		expect(Object.keys(languageOptions('  '))).toHaveLength(size);
		expect(Object.keys(languageOptions(undefined))).toHaveLength(size);
		expect(Object.keys(languageOptions(5))).toHaveLength(size);
	});
});
