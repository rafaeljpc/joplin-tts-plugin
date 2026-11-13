/** Language / locale codes offered by the language setting (name in English, code). */
const LANGUAGES: [string, string][] = [
	['af-ZA', 'Afrikaans (South Africa)'],
	['ar', 'Arabic'],
	['ar-SA', 'Arabic (Saudi Arabia)'],
	['bg-BG', 'Bulgarian'],
	['ca-ES', 'Catalan'],
	['cs-CZ', 'Czech'],
	['da-DK', 'Danish'],
	['de-AT', 'German (Austria)'],
	['de-CH', 'German (Switzerland)'],
	['de-DE', 'German (Germany)'],
	['el-GR', 'Greek'],
	['en-AU', 'English (Australia)'],
	['en-CA', 'English (Canada)'],
	['en-GB', 'English (United Kingdom)'],
	['en-IN', 'English (India)'],
	['en-US', 'English (United States)'],
	['es-AR', 'Spanish (Argentina)'],
	['es-CO', 'Spanish (Colombia)'],
	['es-ES', 'Spanish (Spain)'],
	['es-MX', 'Spanish (Mexico)'],
	['es-US', 'Spanish (United States)'],
	['fa-IR', 'Persian'],
	['fi-FI', 'Finnish'],
	['fr-BE', 'French (Belgium)'],
	['fr-CA', 'French (Canada)'],
	['fr-CH', 'French (Switzerland)'],
	['fr-FR', 'French (France)'],
	['he-IL', 'Hebrew'],
	['hi-IN', 'Hindi'],
	['hr-HR', 'Croatian'],
	['hu-HU', 'Hungarian'],
	['id-ID', 'Indonesian'],
	['is-IS', 'Icelandic'],
	['it-IT', 'Italian'],
	['ja-JP', 'Japanese'],
	['ko-KR', 'Korean'],
	['ms-MY', 'Malay'],
	['nb-NO', 'Norwegian (Bokmal)'],
	['nl-BE', 'Dutch (Belgium)'],
	['nl-NL', 'Dutch (Netherlands)'],
	['pl-PL', 'Polish'],
	['pt-BR', 'Portuguese (Brazil)'],
	['pt-PT', 'Portuguese (Portugal)'],
	['ro-RO', 'Romanian'],
	['ru-RU', 'Russian'],
	['sk-SK', 'Slovak'],
	['sl-SI', 'Slovenian'],
	['sr-RS', 'Serbian'],
	['sv-SE', 'Swedish'],
	['sw-KE', 'Swahili'],
	['ta-IN', 'Tamil'],
	['th-TH', 'Thai'],
	['tr-TR', 'Turkish'],
	['uk-UA', 'Ukrainian'],
	['vi-VN', 'Vietnamese'],
	['zh-CN', 'Chinese (Simplified, China)'],
	['zh-HK', 'Chinese (Cantonese, Hong Kong)'],
	['zh-TW', 'Chinese (Traditional, Taiwan)'],
];

/**
 * Options of the language dropdown, sorted by name. A stored value that is not
 * in the list (for example `pt` or `es-AR` typed by hand in an older version)
 * is kept as an extra "Custom" option so it is never lost.
 */
export function languageOptions(current?: unknown): Record<string, string> {
	const options: Record<string, string> = {};
	const sorted = [...LANGUAGES].sort((a, b) => a[1].localeCompare(b[1]));
	for (const [code, name] of sorted) options[code] = `${name} — ${code}`;
	if (typeof current === 'string' && current.trim() !== '' && !(current in options)) {
		options[current] = `Custom — ${current}`;
	}
	return options;
}
