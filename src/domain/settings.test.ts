import {
	clampRate,
	DEFAULT_SETTINGS,
	MAX_RATE,
	MIN_RATE,
	normalizeEngine,
	normalizeSettings,
	settingKey,
	SETTING_KEYS,
} from './settings';

describe('settings', () => {
	it('clamps rates and falls back for garbage', () => {
		expect(clampRate(1.5)).toBe(1.5);
		expect(clampRate(0.01)).toBe(MIN_RATE);
		expect(clampRate(99)).toBe(MAX_RATE);
		expect(clampRate('abc')).toBe(DEFAULT_SETTINGS.rate);
		expect(clampRate(-1)).toBe(DEFAULT_SETTINGS.rate);
		expect(clampRate('1.25')).toBe(1.25);
	});

	it('normalizes the engine', () => {
		expect(normalizeEngine('google-cloud')).toBe('google-cloud');
		expect(normalizeEngine('azure')).toBe('azure');
		expect(normalizeEngine('google-translate')).toBe('google-translate');
		expect(normalizeEngine('whatever')).toBe('webspeech');
	});

	it('returns defaults for an empty object', () => {
		expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps valid values and trims strings', () => {
		expect(
			normalizeSettings({
				engine: 'azure',
				azureApiKey: ' az ',
				azureRegion: ' brazilsouth ',
				voice: 'v1',
				rate: '1.5',
				googleApiKey: '  key  ',
				language: ' pt-BR ',
				readTitle: false,
			}),
		).toEqual({
			engine: 'azure',
			azureApiKey: 'az',
			azureRegion: 'brazilsouth',
			voice: 'v1',
			rate: 1.5,
			googleApiKey: 'key',
			language: 'pt-BR',
			readTitle: false,
		});
	});

	it('rejects wrongly typed values', () => {
		const result = normalizeSettings({
			voice: 5,
			googleApiKey: 5,
			language: '  ',
			readTitle: 0,
		});
		expect(result.voice).toBe('');
		expect(result.googleApiKey).toBe('');
		expect(result.language).toBe(DEFAULT_SETTINGS.language);
		expect(result.readTitle).toBe(false);
	});

	it('namespaces keys', () => {
		expect(settingKey('rate')).toBe('tts.rate');
		expect(SETTING_KEYS).toEqual(Object.keys(DEFAULT_SETTINGS));
	});
});
