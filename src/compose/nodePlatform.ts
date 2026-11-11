import * as fs from 'fs';
import { FetchFn, FsLike } from '../adapters/piperStorage';

/** Set by webpack for Node bundles: a `require` that is not rewritten by the bundler. */
declare const __non_webpack_require__: ((id: string) => unknown) | undefined;

/** What the plugin process offers (Node): the only place that reads these globals. */
export interface NodePlatform {
	fs: FsLike;
	fetchFn: FetchFn;
	/** Loads a downloaded script by its absolute path. */
	requireFn: (id: string) => unknown;
}

export function nodePlatform(): NodePlatform {
	return {
		fs: fs.promises as unknown as FsLike,
		fetchFn: (url) => {
			if (typeof fetch !== 'function') throw new Error('Downloads are not available here');
			return fetch(url);
		},
		requireFn: (id) => {
			if (typeof __non_webpack_require__ !== 'function') {
				throw new Error('The Piper runtime cannot be loaded here');
			}
			return __non_webpack_require__(id);
		},
	};
}
