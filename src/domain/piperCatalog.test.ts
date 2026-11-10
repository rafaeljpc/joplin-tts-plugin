import {
	catalogFileUrl,
	DEFAULT_PIPER_CATALOG_URL,
	formatSize,
	normalizeCatalogUrl,
	parsePiperCatalog,
	PiperVoice,
	voicesForLanguage,
} from './piperCatalog';

const entry = (code: string, name: string, quality: string, model = 60_000_000) => ({
	name,
	quality,
	language: { code },
	files: {
		[`x/${code}-${name}-${quality}.onnx`]: { size_bytes: model },
		[`x/${code}-${name}-${quality}.onnx.json`]: { size_bytes: 4000 },
		'x/MODEL_CARD': { size_bytes: 273 },
	},
});

const RAW = {
	'pt_BR-faber-medium': entry('pt_BR', 'faber', 'medium'),
	'en_US-amy-low': entry('en_US', 'amy', 'low', 63_104_526),
	'en_GB-alan-low': entry('en_GB', 'alan', 'low'),
};

describe('normalizeCatalogUrl', () => {
	it('keeps one trailing slash', () => {
		expect(normalizeCatalogUrl('https://a.b/c')).toBe('https://a.b/c/');
		expect(normalizeCatalogUrl(' https://a.b/c/// ')).toBe('https://a.b/c/');
	});

	it('falls back to the default when blank, not http(s) or not a string', () => {
		for (const bad of ['', '  ', 'ftp://a.b', 'a.b', 'https://a b', 5, undefined]) {
			expect(normalizeCatalogUrl(bad)).toBe(DEFAULT_PIPER_CATALOG_URL);
		}
	});
});

describe('catalogFileUrl', () => {
	it('joins the catalog URL and a path', () => {
		expect(catalogFileUrl('https://a.b/c', '/en/x.onnx')).toBe('https://a.b/c/en/x.onnx');
		expect(catalogFileUrl('bad', 'v.json')).toBe(`${DEFAULT_PIPER_CATALOG_URL}v.json`);
	});
});

describe('parsePiperCatalog', () => {
	it('lists the voices sorted by id with only the model and its configuration', () => {
		const voices = parsePiperCatalog(RAW);
		expect(voices.map((v) => v.id)).toEqual([
			'en_GB-alan-low',
			'en_US-amy-low',
			'pt_BR-faber-medium',
		]);
		const amy = voices[1];
		expect(amy).toMatchObject({ name: 'amy', language: 'en_US', quality: 'low' });
		expect(amy.files.map((f) => f.path)).toEqual([
			'x/en_US-amy-low.onnx',
			'x/en_US-amy-low.onnx.json',
		]);
		expect(amy.sizeBytes).toBe(63_104_526 + 4000);
	});

	it('ignores entries it cannot use', () => {
		const onlyModel = { name: 'a', language: { code: 'en_US' }, files: { 'a.onnx': {} } };
		const noLanguage = { files: entry('en_US', 'b', 'low').files };
		expect(
			parsePiperCatalog({
				ok: entry('en_US', 'ok', 'low'),
				onlyModel,
				noLanguage,
				notAnObject: 5,
				noFiles: { language: { code: 'en_US' } },
			}).map((v) => v.id),
		).toEqual(['ok']);
	});

	it('uses the id as the name and zero for unknown sizes and qualities', () => {
		const [voice] = parsePiperCatalog({
			v: {
				language: { code: 'en_US' },
				files: { 'v.onnx': { size_bytes: 'x' }, 'v.onnx.json': 5 },
			},
		});
		expect(voice).toMatchObject({ name: 'v', quality: '', sizeBytes: 0 });
	});

	it('returns an empty list for anything that is not an object', () => {
		expect(parsePiperCatalog(null)).toEqual([]);
		expect(parsePiperCatalog('x')).toEqual([]);
	});
});

describe('voicesForLanguage', () => {
	const voices: PiperVoice[] = parsePiperCatalog(RAW);
	const ids = (list: PiperVoice[]) => list.map((v) => v.id);

	it('matches a locale with either separator', () => {
		expect(ids(voicesForLanguage(voices, 'pt-BR'))).toEqual(['pt_BR-faber-medium']);
		expect(ids(voicesForLanguage(voices, 'en_us'))).toEqual(['en_US-amy-low']);
	});

	it('matches every region when the code has none', () => {
		expect(ids(voicesForLanguage(voices, 'en'))).toEqual(['en_GB-alan-low', 'en_US-amy-low']);
	});

	it('returns everything for a blank language and nothing for an unknown one', () => {
		expect(voicesForLanguage(voices, ' ')).toBe(voices);
		expect(voicesForLanguage(voices, 'xx-YY')).toEqual([]);
	});
});

describe('formatSize', () => {
	it('formats megabytes and kilobytes', () => {
		expect(formatSize(63_108_526)).toBe('60.2 MB');
		expect(formatSize(4164)).toBe('4 KB');
		expect(formatSize(10)).toBe('1 KB');
	});

	it('is empty when the size is unknown', () => {
		expect(formatSize(0)).toBe('');
		expect(formatSize(NaN)).toBe('');
		expect(formatSize(-5)).toBe('');
	});
});
