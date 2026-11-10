import { EngineId, Settings } from './types';

export const SETTINGS_SECTION = 'ttsPlugin';

export const DEFAULT_SETTINGS: Settings = {
	engine: 'webspeech',
	voice: '',
	rate: 1,
	googleApiKey: '',
	googleLanguage: 'en-US',
	readTitle: true,
};

export const MIN_RATE = 0.5;
export const MAX_RATE = 3;

export const clampRate = (rate: unknown): number => {
	const n = Number(rate);
	if (!Number.isFinite(n) || n <= 0) return DEFAULT_SETTINGS.rate;
	return Math.min(MAX_RATE, Math.max(MIN_RATE, n));
};

export const normalizeEngine = (engine: unknown): EngineId =>
	engine === 'google' ? 'google' : 'webspeech';

/** Coerces untrusted stored values into a valid Settings object. */
export const normalizeSettings = (raw: Partial<Record<keyof Settings, unknown>>): Settings => ({
	engine: normalizeEngine(raw.engine),
	voice: typeof raw.voice === 'string' ? raw.voice : DEFAULT_SETTINGS.voice,
	rate: clampRate(raw.rate ?? DEFAULT_SETTINGS.rate),
	googleApiKey: typeof raw.googleApiKey === 'string' ? raw.googleApiKey.trim() : '',
	googleLanguage:
		typeof raw.googleLanguage === 'string' && raw.googleLanguage.trim()
			? raw.googleLanguage.trim()
			: DEFAULT_SETTINGS.googleLanguage,
	readTitle: raw.readTitle === undefined ? DEFAULT_SETTINGS.readTitle : Boolean(raw.readTitle),
});

/** Prefix used for every setting key so they never clash with other plugins. */
export const settingKey = (key: keyof Settings): string => `tts.${key}`;

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
