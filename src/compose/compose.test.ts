import joplin from 'api';
import * as nodePath from 'path';
import { DEFAULT_SETTINGS } from '../domain/settings';
import { nodePlatform } from './nodePlatform';
import { composePiper } from './pluginRoot';

const j = joplin as unknown as { plugins: { dataDir: jest.Mock } };
const g = globalThis as { fetch?: unknown; __non_webpack_require__?: unknown };

describe('nodePlatform', () => {
	afterEach(() => {
		delete g.fetch;
		delete g.__non_webpack_require__;
	});

	it('offers the file system', () => {
		expect(typeof nodePlatform().fs.readFile).toBe('function');
	});

	it('explains when downloads or the runtime cannot be used', () => {
		delete g.fetch;
		const platform = nodePlatform();
		expect(() => platform.fetchFn('https://x.test')).toThrow('Downloads are not available');
		expect(() => platform.requireFn('/x.js')).toThrow('The Piper runtime cannot be loaded here');
	});

	it('uses fetch and the bundler-independent require when they exist', () => {
		const fetchMock = jest.fn().mockReturnValue('response');
		const requireMock = jest.fn().mockReturnValue('module');
		g.fetch = fetchMock;
		g.__non_webpack_require__ = requireMock;
		const platform = nodePlatform();
		expect(platform.fetchFn('https://x.test')).toBe('response');
		expect(fetchMock).toHaveBeenCalledWith('https://x.test');
		expect(platform.requireFn('/x.js')).toBe('module');
		expect(requireMock).toHaveBeenCalledWith('/x.js');
	});
});

describe('composePiper', () => {
	it('keeps Piper in the plugin data folder and reads the catalog URL from the settings', async () => {
		j.plugins.dataDir.mockResolvedValue('/joplin/data');
		const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 500 });
		const piper = await composePiper(
			async () => ({ ...DEFAULT_SETTINGS, piperCatalogUrl: 'https://mirror.test/v/' }),
			{ fetchFn },
		);
		await expect(piper.storage.fetchCatalog()).rejects.toThrow('500');
		expect(fetchFn).toHaveBeenCalledWith('https://mirror.test/v/voices.json');
		expect(piper.storage.runtimeDir).toBe(nodePath.join('/joplin/data', 'piper', 'runtime'));
	});

	it('lets the caller replace any part of the platform', async () => {
		const fs = nodePlatform().fs;
		const requireFn = jest.fn();
		const piper = await composePiper(async () => DEFAULT_SETTINGS, {
			dir: nodePath.join('/custom', 'piper'),
			fs,
			fetchFn: jest.fn(),
			requireFn,
		});
		expect(piper.storage.runtimeDir).toBe(nodePath.join('/custom', 'piper', 'runtime'));
	});
});
