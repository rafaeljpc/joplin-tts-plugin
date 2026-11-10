import joplin from 'api';
import { DEFAULT_SETTINGS } from './domain/settings';
import { Settings } from './domain/types';
import { createPiper, PiperDeps } from './piper';
import { FsLike } from './adapters/piperStorage';

const j = joplin as unknown as {
	plugins: { dataDir: jest.Mock };
};

const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

const META = (id: string, language = 'pt_BR', quality = 'medium') =>
	JSON.stringify({ id, name: id.split('-')[1], language, quality, sizeBytes: 5 });

/** A file system holding the given downloaded voices (and nothing else). */
function fsWith(...ids: string[]): FsLike {
	const files = new Map<string, Uint8Array>();
	for (const id of ids) {
		for (const [name, content] of [
			['meta.json', META(id)],
			['model.onnx', 'M'],
			[
				'model.onnx.json',
				'{"audio":{"sample_rate":1},"espeak":{"voice":"x"},"inference":{"noise_scale":1,"length_scale":1,"noise_w":1}}',
			],
		]) {
			files.set(
				`/data/piper/voices/${id}/${name}`.replace(/\//g, require('path').sep),
				Buffer.from(content),
			);
		}
	}
	const sep = require('path').sep;
	return {
		mkdir: async () => undefined,
		readdir: async (path) => {
			const prefix = path + sep;
			return [
				...new Set(
					[...files.keys()]
						.filter((k) => k.startsWith(prefix))
						.map((k) => k.slice(prefix.length).split(sep)[0]),
				),
			];
		},
		readFile: async (path) => files.get(path) as Uint8Array,
		writeFile: async () => undefined,
		rename: async () => undefined,
		rm: async () => undefined,
		stat: async (path) => {
			const data = files.get(path);
			if (!data) throw new Error('ENOENT');
			return { size: data.length };
		},
	};
}

const depsFor = (...ids: string[]): PiperDeps => ({
	dir: require('path').join('/data', 'piper'),
	fs: fsWith(...ids),
	fetchFn: jest.fn(),
	requireFn: jest.fn(),
});

/** A runtime stand-in, so synthesis gets as far as reading the voice. */
const loadableRuntime = (piper: { storage: { ensureRuntime: () => Promise<void> } }) => {
	jest.spyOn(piper.storage, 'ensureRuntime').mockResolvedValue(undefined);
};
const fakeRequire = (id: string) =>
	id.endsWith('ort.wasm.min.js')
		? { env: { wasm: {} }, InferenceSession: { create: jest.fn() } }
		: jest.fn();

describe('createPiper', () => {
	beforeEach(() => {
		j.plugins.dataDir.mockResolvedValue('/joplin/data');
	});

	it('lists the downloaded voices for the player', async () => {
		const piper = await createPiper(async () => settings(), depsFor('pt_BR-faber-medium'));
		await expect(piper.voices()).resolves.toEqual({
			voices: [{ id: 'pt_BR-faber-medium', name: 'faber (pt-BR, medium)', lang: 'pt-BR' }],
		});
		await expect(piper.hasVoices()).resolves.toBe(true);
		const none = await createPiper(async () => settings(), depsFor());
		await expect(none.hasVoices()).resolves.toBe(false);
	});

	it('says how to get a voice when none is downloaded', async () => {
		const piper = await createPiper(async () => settings(), depsFor());
		await expect(piper.synthesize('Hi', '')).resolves.toMatchObject({
			ok: false,
			error: expect.stringContaining('No Piper voice is downloaded'),
		});
	});

	it('reports a failure of the runtime instead of throwing', async () => {
		const deps = depsFor('pt_BR-faber-medium');
		(deps.fetchFn as jest.Mock).mockRejectedValue(new Error('offline'));
		const piper = await createPiper(async () => settings(), deps);
		await expect(piper.synthesize('Hi', 'pt_BR-faber-medium')).resolves.toEqual({
			ok: false,
			error: 'offline',
		});
	});

	it('stringifies errors that are not Error objects', async () => {
		const deps = depsFor('pt_BR-faber-medium');
		(deps.fetchFn as jest.Mock).mockRejectedValue('weird');
		const piper = await createPiper(async () => settings(), deps);
		await expect(piper.synthesize('Hi', 'pt_BR-faber-medium')).resolves.toEqual({
			ok: false,
			error: 'weird',
		});
	});

	it('prefers the requested voice, then the saved one, then any downloaded voice', async () => {
		const deps = { ...depsFor('pt_BR-faber-medium', 'en_US-amy-low'), requireFn: fakeRequire };
		const piper = await createPiper(async () => settings({ voice: 'en_US-amy-low' }), deps);
		loadableRuntime(piper);
		const spy = jest.spyOn(piper.storage, 'readVoice').mockRejectedValue(new Error('stop'));
		await piper.synthesize('x', 'pt_BR-faber-medium');
		await piper.synthesize('x', 'unknown');
		await piper.synthesize('x', '');
		expect(spy.mock.calls.map(([id]) => id)).toEqual([
			'pt_BR-faber-medium',
			'en_US-amy-low',
			'en_US-amy-low',
		]);

		const other = await createPiper(async () => settings({ voice: 'azure-voice' }), deps);
		loadableRuntime(other);
		const spy2 = jest.spyOn(other.storage, 'readVoice').mockRejectedValue(new Error('stop'));
		await other.synthesize('x', '');
		expect(spy2.mock.calls.map(([id]) => id)).toEqual(['en_US-amy-low']);
	});

	it('uses the plugin data folder by default and the voice catalog URL from the settings', async () => {
		const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 500 });
		const piper = await createPiper(
			async () => settings({ piperCatalogUrl: 'https://mirror.test/v/' }),
			{
				fs: fsWith(),
				fetchFn,
			},
		);
		await expect(piper.storage.fetchCatalog()).rejects.toThrow('500');
		expect(fetchFn).toHaveBeenCalledWith('https://mirror.test/v/voices.json');
		expect(piper.storage.runtimeDir).toBe(require('path').join('/joplin/data', 'piper', 'runtime'));
	});

	it('loads the downloaded runtime scripts', async () => {
		const deps = depsFor('pt_BR-faber-medium');
		const requireFn = deps.requireFn as jest.Mock;
		const ort = {
			env: { wasm: {} },
			InferenceSession: { create: jest.fn().mockRejectedValue(new Error('no session')) },
		};
		requireFn.mockImplementation((id: string) =>
			id.endsWith('ort.wasm.min.js') ? ort : jest.fn(),
		);
		const piper = await createPiper(async () => settings(), deps);
		jest.spyOn(piper.storage, 'ensureRuntime').mockResolvedValue(undefined);
		await expect(piper.synthesize('x', 'pt_BR-faber-medium')).resolves.toEqual({
			ok: false,
			error: 'no session',
		});
		expect(requireFn.mock.calls.map(([id]) => require('path').basename(id))).toEqual([
			'ort.wasm.min.js',
			'piper_phonemize.js',
		]);
	});

	describe('default environment', () => {
		const g = globalThis as { fetch?: unknown; __non_webpack_require__?: unknown };
		afterEach(() => {
			delete g.fetch;
			delete g.__non_webpack_require__;
		});

		it('explains when downloads or the runtime cannot be used', async () => {
			delete g.fetch;
			const piper = await createPiper(async () => settings(), {
				dir: require('path').join('/data', 'piper'),
				fs: fsWith('pt_BR-faber-medium'),
			});
			loadableRuntime(piper);
			await expect(piper.storage.fetchCatalog()).rejects.toThrow('Downloads are not available');
			await expect(piper.synthesize('x', 'pt_BR-faber-medium')).resolves.toEqual({
				ok: false,
				error: 'The Piper runtime cannot be loaded here',
			});
		});

		it('uses fetch and the bundler-independent require when they exist', async () => {
			const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 404 });
			g.fetch = fetchMock;
			const requireMock = jest.fn().mockReturnValue({});
			g.__non_webpack_require__ = requireMock;
			const piper = await createPiper(async () => settings(), {
				dir: require('path').join('/data', 'piper'),
				fs: fsWith('pt_BR-faber-medium'),
			});
			await expect(piper.storage.fetchCatalog()).rejects.toThrow('404');
			expect(fetchMock).toHaveBeenCalled();
			jest.spyOn(piper.storage, 'ensureRuntime').mockResolvedValue(undefined);
			await piper.synthesize('x', 'pt_BR-faber-medium');
			expect(requireMock).toHaveBeenCalled();
		});
	});
});
