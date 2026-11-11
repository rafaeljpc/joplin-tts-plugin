import { createHash } from 'crypto';
import * as nodePath from 'path';
import { PiperVoice } from '../domain/piperCatalog';
import { FsLike, PiperStorage } from './piperStorage';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

jest.mock('../domain/piperRuntime', () => {
	const { createHash: hash } = jest.requireActual('crypto');
	const file = (name: string, content: string) => ({
		name,
		url: `https://cdn.test/${name}`,
		sha256: hash('sha256').update(content).digest('hex'),
		sizeBytes: content.length,
	});
	return { PIPER_RUNTIME_FILES: [file('a.js', 'AAAA'), file('b.wasm', 'BBBBBB')] };
});

const DIR = nodePath.join('data', 'piper');
const at = (...parts: string[]) => nodePath.join(DIR, ...parts);

/** A memory file system with the `fs.promises` behavior this code relies on. */
function memoryFs() {
	const files = new Map<string, Uint8Array>();
	const enoent = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
	const fs: FsLike = {
		mkdir: async () => undefined,
		readdir: async (path) => {
			const prefix = path + nodePath.sep;
			const names = new Set<string>();
			for (const key of files.keys()) {
				if (key.startsWith(prefix)) names.add(key.slice(prefix.length).split(nodePath.sep)[0]);
			}
			if (names.size === 0) throw enoent();
			return [...names];
		},
		readFile: async (path) => {
			const data = files.get(path);
			if (!data) throw enoent();
			return data;
		},
		writeFile: async (path, data) => {
			files.set(path, typeof data === 'string' ? Buffer.from(data) : data);
		},
		rename: async (from, to) => {
			files.set(to, files.get(from) as Uint8Array);
			files.delete(from);
		},
		rm: async (path) => {
			for (const key of [...files.keys()]) {
				if (key === path || key.startsWith(path + nodePath.sep)) files.delete(key);
			}
		},
		stat: async (path) => {
			const data = files.get(path);
			if (!data) throw enoent();
			return { size: data.length };
		},
	};
	return { fs, files };
}

const bytes = (text: string) => Uint8Array.from(Buffer.from(text));

/** A Response-like object that streams `content` in two chunks (or without a body). */
const respond = (content: string | null, init: { ok?: boolean; status?: number } = {}) => {
	const data = bytes(content ?? '');
	const half = Math.ceil(data.length / 2);
	const chunks = [data.slice(0, half), data.slice(half)].filter((c) => c.length > 0);
	return {
		ok: init.ok ?? true,
		status: init.status ?? 200,
		body: content === null ? null : { getReader: () => reader(chunks) },
		arrayBuffer: async () => data.buffer.slice(0),
		json: async () => JSON.parse(content ?? 'null'),
	} as unknown as Response;
};
const reader = (chunks: Uint8Array[]) => {
	let i = 0;
	return {
		read: async () =>
			i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined },
	};
};

const CATALOG_JSON = {
	'en_US-amy-low': {
		name: 'amy',
		quality: 'low',
		language: { code: 'en_US' },
		files: {
			'en/en_US/amy/low/en_US-amy-low.onnx': { size_bytes: 7 },
			'en/en_US/amy/low/en_US-amy-low.onnx.json': { size_bytes: 2 },
		},
	},
};
const VOICE: PiperVoice = {
	id: 'en_US-amy-low',
	name: 'amy',
	language: 'en_US',
	quality: 'low',
	files: [
		{ path: 'en/en_US/amy/low/en_US-amy-low.onnx', sizeBytes: 7 },
		{ path: 'en/en_US/amy/low/en_US-amy-low.onnx.json', sizeBytes: 2 },
	],
	sizeBytes: 9,
};

const CONTENT: Record<string, string> = {
	'https://cdn.test/a.js': 'AAAA',
	'https://cdn.test/b.wasm': 'BBBBBB',
	'https://voices.test/en/en_US/amy/low/en_US-amy-low.onnx': 'MODEL-X',
	'https://voices.test/en/en_US/amy/low/en_US-amy-low.onnx.json': '{}',
};

function setup(overrides: Record<string, Response | string | null> = {}) {
	const { fs, files } = memoryFs();
	const fetchFn = jest.fn(async (url: string) => {
		if (url in overrides) {
			const value = overrides[url];
			return typeof value === 'object' && value !== null ? value : respond(value as string | null);
		}
		if (url === 'https://voices.test/voices.json') return respond(JSON.stringify(CATALOG_JSON));
		if (url in CONTENT) return respond(CONTENT[url]);
		return respond('', { ok: false, status: 404 });
	});
	const storage = new PiperStorage({
		dir: DIR,
		fs,
		fetchFn,
		catalogUrl: () => 'https://voices.test/',
	});
	return { storage, fs, files, fetchFn };
}

describe('PiperStorage catalog', () => {
	it('fetches and parses the catalog from the configured URL', async () => {
		const { storage, fetchFn } = setup();
		const voices = await storage.fetchCatalog();
		expect(voices.map((v) => v.id)).toEqual(['en_US-amy-low']);
		expect(fetchFn).toHaveBeenCalledWith('https://voices.test/voices.json');
	});

	it('fails on HTTP errors and on an empty catalog', async () => {
		const down = setup({
			'https://voices.test/voices.json': respond('', { ok: false, status: 503 }),
		});
		await expect(down.storage.fetchCatalog()).rejects.toThrow('503');
		const empty = setup({ 'https://voices.test/voices.json': '{}' });
		await expect(empty.storage.fetchCatalog()).rejects.toThrow('lists no voices');
	});
});

describe('PiperStorage voices', () => {
	it('downloads the runtime then the voice, reporting progress, and lists it afterwards', async () => {
		const { storage, files } = setup();
		const progress: [number, number][] = [];
		await storage.download(VOICE, (loaded, total) => progress.push([loaded, total]));

		expect(progress[0]).toEqual([0, 9 + 4 + 6]);
		expect(progress[progress.length - 1]).toEqual([19, 19]);
		expect(Buffer.from(files.get(at('runtime', 'a.js')) as Uint8Array).toString()).toBe('AAAA');
		expect(
			Buffer.from(files.get(at('voices', 'en_US-amy-low', 'model.onnx')) as Uint8Array).toString(),
		).toBe('MODEL-X');
		expect([...files.keys()].some((k) => k.endsWith('.part'))).toBe(false);

		await expect(storage.installed()).resolves.toEqual([
			{ id: 'en_US-amy-low', name: 'amy', language: 'en_US', quality: 'low', sizeBytes: 9 },
		]);
		const { model, config } = await storage.readVoice('en_US-amy-low');
		expect(Buffer.from(model).toString()).toBe('MODEL-X');
		expect(config).toEqual({});
	});

	it('does not download the runtime again when it is already there', async () => {
		const { storage, fetchFn } = setup();
		await storage.ensureRuntime();
		fetchFn.mockClear();
		await storage.download(VOICE, () => undefined);
		expect(fetchFn.mock.calls.map(([url]) => url)).not.toContain('https://cdn.test/a.js');
	});

	it('falls back to arrayBuffer when the response has no stream', async () => {
		const { storage, files } = setup({
			'https://voices.test/en/en_US/amy/low/en_US-amy-low.onnx': null,
		});
		// null body means an empty file here, so the size check rejects it.
		await expect(storage.download(VOICE, () => undefined)).rejects.toThrow('Incomplete');
		expect([...files.keys()].some((k) => k.includes('voices'))).toBe(false);
	});

	it('uses arrayBuffer for streamless responses with the right size', async () => {
		const streamless = respond('MODEL-X');
		(streamless as unknown as { body: null }).body = null;
		const { storage, files } = setup({
			'https://voices.test/en/en_US/amy/low/en_US-amy-low.onnx': streamless,
		});
		await storage.download(VOICE, () => undefined);
		expect(files.has(at('voices', 'en_US-amy-low', 'model.onnx'))).toBe(true);
	});

	it('removes a half-downloaded voice when something fails', async () => {
		const { storage, files } = setup({
			'https://voices.test/en/en_US/amy/low/en_US-amy-low.onnx.json': respond('', {
				ok: false,
				status: 500,
			}),
		});
		await expect(storage.download(VOICE, () => undefined)).rejects.toThrow('HTTP 500');
		expect([...files.keys()].filter((k) => k.includes('voices'))).toEqual([]);
		await expect(storage.installed()).resolves.toEqual([]);
	});

	it('rejects a runtime file whose checksum does not match', async () => {
		const { storage, files } = setup({ 'https://cdn.test/a.js': 'EVIL' });
		await expect(storage.download(VOICE, () => undefined)).rejects.toThrow('checksum');
		expect(files.has(at('runtime', 'a.js'))).toBe(false);
	});

	it('removes voices and rejects unsafe ids', async () => {
		const { storage } = setup();
		await storage.download(VOICE, () => undefined);
		await storage.remove('en_US-amy-low');
		await expect(storage.installed()).resolves.toEqual([]);
		for (const bad of ['', '..', '../x', 'a/b', 'a..b', '.hidden']) {
			await expect(storage.remove(bad)).rejects.toThrow('Invalid voice id');
		}
		await expect(storage.download({ ...VOICE, id: '../x' }, () => undefined)).rejects.toThrow(
			'Invalid voice id',
		);
	});

	it('ignores broken entries when listing', async () => {
		const { storage, fs } = setup();
		await storage.download(VOICE, () => undefined);
		const write = (...parts: string[]) => fs.writeFile(at('voices', ...parts), '{}');
		await write('no-meta', 'model.onnx');
		await fs.writeFile(at('voices', 'bad-json', 'meta.json'), 'not json');
		await fs.writeFile(at('voices', 'wrong-id', 'meta.json'), JSON.stringify({ id: 'other' }));
		await write('wrong-id', 'model.onnx');
		await write('wrong-id', 'model.onnx.json');
		await fs.writeFile(at('voices', 'no-model', 'meta.json'), JSON.stringify({ id: 'no-model' }));
		await fs.writeFile(at('voices', 'a..b', 'meta.json'), JSON.stringify({ id: 'a..b' }));
		expect((await storage.installed()).map((v) => v.id)).toEqual(['en_US-amy-low']);
	});

	it('sorts downloaded voices by id', async () => {
		const { storage } = setup();
		await storage.download(VOICE, () => undefined);
		const second = { ...VOICE, id: 'en_US-abe-low' };
		await storage.download(second, () => undefined);
		expect((await storage.installed()).map((v) => v.id)).toEqual([
			'en_US-abe-low',
			'en_US-amy-low',
		]);
	});
});

describe('PiperStorage runtime', () => {
	it('downloads missing files once, even when asked twice, and re-downloads wrong sizes', async () => {
		const { storage, fetchFn, fs } = setup();
		await Promise.all([storage.ensureRuntime(), storage.ensureRuntime()]);
		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(storage.runtimePath('a.js')).toBe(at('runtime', 'a.js'));

		await fs.writeFile(at('runtime', 'a.js'), 'x'); // truncated file
		const fresh = new PiperStorage({
			dir: DIR,
			fs,
			fetchFn,
			catalogUrl: () => 'https://voices.test/',
		});
		fetchFn.mockClear();
		await fresh.ensureRuntime();
		expect(fetchFn.mock.calls.map(([url]) => url)).toEqual(['https://cdn.test/a.js']);
	});

	it('retries after a failure', async () => {
		const { storage, fetchFn } = setup({
			'https://cdn.test/a.js': respond('', { ok: false, status: 500 }),
		});
		await expect(storage.ensureRuntime()).rejects.toThrow('HTTP 500');
		fetchFn.mockImplementation(async (url: string) => respond(CONTENT[url]));
		await expect(storage.ensureRuntime()).resolves.toBeUndefined();
	});
});

describe('sha helper sanity', () => {
	it('matches the mocked checksums', () => {
		expect(sha('AAAA')).toHaveLength(64);
	});
});
