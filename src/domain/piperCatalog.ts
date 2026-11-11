/**
 * Catalog of Piper voices (https://huggingface.co/rhasspy/piper-voices). The
 * catalog URL is a setting, so if the repository moves only the default changes.
 */

export const DEFAULT_PIPER_CATALOG_URL =
	'https://huggingface.co/rhasspy/piper-voices/resolve/main/';

/** File listing every voice, relative to the catalog URL. */
export const PIPER_CATALOG_FILE = 'voices.json';

export interface PiperFile {
	/** Path relative to the catalog URL. */
	path: string;
	sizeBytes: number;
}

export interface PiperVoice {
	/** For example `pt_BR-faber-medium`. */
	id: string;
	name: string;
	/** Locale as written by Piper, for example `pt_BR`. */
	language: string;
	quality: string;
	/** The files needed to speak: the model and its configuration. */
	files: PiperFile[];
	/** Total download size of `files`. */
	sizeBytes: number;
}

/** The catalog URL with exactly one trailing slash, or the default when it is blank or not http(s). */
export const normalizeCatalogUrl = (url: unknown): string => {
	const value = typeof url === 'string' ? url.trim() : '';
	if (!/^https?:\/\/\S+$/i.test(value)) return DEFAULT_PIPER_CATALOG_URL;
	return value.replace(/\/+$/, '') + '/';
};

export const catalogFileUrl = (catalogUrl: string, path: string): string =>
	normalizeCatalogUrl(catalogUrl) + path.replace(/^\/+/, '');

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const MODEL_FILE = /\.onnx(\.json)?$/;

const parseVoice = (id: string, entry: unknown): PiperVoice | null => {
	if (!isRecord(entry) || !isRecord(entry.files)) return null;
	const files: PiperFile[] = [];
	for (const [path, info] of Object.entries(entry.files)) {
		if (!MODEL_FILE.test(path)) continue;
		const sizeBytes = isRecord(info) ? Number(info.size_bytes) : NaN;
		files.push({ path, sizeBytes: Number.isFinite(sizeBytes) && sizeBytes > 0 ? sizeBytes : 0 });
	}
	// A voice needs both the model and its configuration.
	const hasModel = files.some((f) => f.path.endsWith('.onnx'));
	const hasConfig = files.some((f) => f.path.endsWith('.onnx.json'));
	const language = isRecord(entry.language) ? entry.language.code : undefined;
	if (!hasModel || !hasConfig || typeof language !== 'string') return null;
	return {
		id,
		name: typeof entry.name === 'string' ? entry.name : id,
		language,
		quality: typeof entry.quality === 'string' ? entry.quality : '',
		files,
		sizeBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
	};
};

/** Reads the catalog's JSON, ignoring entries that cannot be used. Sorted by id. */
export const parsePiperCatalog = (raw: unknown): PiperVoice[] => {
	if (!isRecord(raw)) return [];
	return Object.entries(raw)
		.map(([id, entry]) => parseVoice(id, entry))
		.filter((voice): voice is PiperVoice => voice !== null)
		.sort((a, b) => a.id.localeCompare(b.id));
};

const normalizeLanguage = (code: string): string => code.replace('-', '_').toLowerCase();

/**
 * Voices that speak `language` (`pt-BR` or `pt_BR` match `pt_BR` exactly; a code
 * without a region, such as `pt`, matches every region of that language).
 */
export const voicesForLanguage = (voices: PiperVoice[], language: string): PiperVoice[] => {
	const wanted = normalizeLanguage(language.trim());
	if (!wanted) return voices;
	return voices.filter((voice) => {
		const code = normalizeLanguage(voice.language);
		return wanted.includes('_') ? code === wanted : code.split('_')[0] === wanted;
	});
};

/** Human-readable size, for example `60.2 MB`; empty when the size is unknown. */
export const formatSize = (bytes: number): string => {
	if (!Number.isFinite(bytes) || bytes <= 0) return '';
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
