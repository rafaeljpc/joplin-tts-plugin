import { DEFAULT_PIPER_CATALOG_URL, normalizeCatalogUrl } from './piperCatalog';
import { EngineId, Settings } from './types';

export const SETTINGS_SECTION = 'ttsPlugin';

export const DEFAULT_SETTINGS: Settings = {
	engine: 'webspeech',
	voice: '',
	rate: 1,
	googleApiKey: '',
	azureApiKey: '',
	azureRegion: 'eastus',
	language: 'en-US',
	readTitle: true,
	piperCatalogUrl: DEFAULT_PIPER_CATALOG_URL,
};

export const MIN_RATE = 0.5;
export const MAX_RATE = 3;

export const clampRate = (rate: unknown): number => {
	const n = Number(rate);
	if (!Number.isFinite(n) || n <= 0) return DEFAULT_SETTINGS.rate;
	return Math.min(MAX_RATE, Math.max(MIN_RATE, n));
};

const ENGINES: EngineId[] = ['webspeech', 'google-translate', 'google-cloud', 'azure'];

export const normalizeEngine = (engine: unknown): EngineId =>
	ENGINES.find((id) => id === engine) ?? 'webspeech';

/** Trimmed string value, or the fallback when it is missing, blank or not a string. */
const trimmed = (value: unknown, fallback: string): string =>
	typeof value === 'string' && value.trim() ? value.trim() : fallback;

/** Coerces untrusted stored values into a valid Settings object. */
export const normalizeSettings = (raw: Partial<Record<keyof Settings, unknown>>): Settings => ({
	engine: normalizeEngine(raw.engine),
	voice: typeof raw.voice === 'string' ? raw.voice : DEFAULT_SETTINGS.voice,
	rate: clampRate(raw.rate ?? DEFAULT_SETTINGS.rate),
	googleApiKey: trimmed(raw.googleApiKey, ''),
	azureApiKey: trimmed(raw.azureApiKey, ''),
	azureRegion: trimmed(raw.azureRegion, DEFAULT_SETTINGS.azureRegion),
	language: trimmed(raw.language, DEFAULT_SETTINGS.language),
	readTitle: raw.readTitle === undefined ? DEFAULT_SETTINGS.readTitle : Boolean(raw.readTitle),
	piperCatalogUrl: normalizeCatalogUrl(raw.piperCatalogUrl),
});

/** Prefix used for every setting key so they never clash with other plugins. */
export const settingKey = (key: keyof Settings): string => `tts.${key}`;

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
