import joplin from 'api';
import * as nodePath from 'path';
import { PiperDeps, PiperService, createPiper } from '../piper';
import { Settings } from '../domain/types';
import { nodePlatform } from './nodePlatform';

/**
 * Composition root of the plugin process: the one place that reads the Joplin API
 * and the Node globals to build the services. Everything else receives what it
 * needs through its constructor or parameters.
 */
export async function composePiper(
	readSettings: () => Promise<Settings>,
	overrides: Partial<PiperDeps> = {},
): Promise<PiperService> {
	const platform = nodePlatform();
	return createPiper(readSettings, {
		dir: overrides.dir ?? nodePath.join(await joplin.plugins.dataDir(), 'piper'),
		fs: overrides.fs ?? platform.fs,
		fetchFn: overrides.fetchFn ?? platform.fetchFn,
		requireFn: overrides.requireFn ?? platform.requireFn,
	});
}
