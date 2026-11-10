import joplin from 'api';
import * as fs from 'fs';
import * as nodePath from 'path';
import { PiperDialogController } from './application/piperDialog';
import { PiperSynthesizeReply, PiperVoicesReply } from './application/messages';
import { FetchFn, FsLike, PiperStorage } from './adapters/piperStorage';
import { CreatePhonemizer, OrtLike, PiperRuntime, PiperSynthesizer } from './adapters/piperSynth';
import { Settings } from './domain/types';

/** Set by webpack for Node bundles: a `require` that is not rewritten by the bundler. */
declare const __non_webpack_require__: ((id: string) => unknown) | undefined;

export interface PiperDeps {
	/** Folder for the runtime and the voices; defaults to `<plugin data folder>/piper`. */
	dir?: string;
	fs?: FsLike;
	fetchFn?: FetchFn;
	/** Loads a downloaded script by its absolute path. */
	requireFn?: (id: string) => unknown;
}

const defaultFetch: FetchFn = (url) => {
	if (typeof fetch !== 'function') throw new Error('Downloads are not available here');
	return fetch(url);
};

const defaultRequire = (id: string): unknown => {
	if (typeof __non_webpack_require__ !== 'function') {
		throw new Error('The Piper runtime cannot be loaded here');
	}
	return __non_webpack_require__(id);
};

/** Offline speech with downloaded Piper voices (plugin side). */
export interface PiperService {
	storage: PiperStorage;
	controller: PiperDialogController;
	/** The voices that are downloaded, as the player lists them. */
	voices(): Promise<PiperVoicesReply>;
	/** True when at least one voice is downloaded. */
	hasVoices(): Promise<boolean>;
	/** Speaks `text`; an unknown or empty `voiceId` falls back to the saved voice, then to any downloaded one. */
	synthesize(text: string, voiceId: string): Promise<PiperSynthesizeReply>;
}

export async function createPiper(
	readSettings: () => Promise<Settings>,
	deps: PiperDeps = {},
): Promise<PiperService> {
	const dir = deps.dir ?? nodePath.join(await joplin.plugins.dataDir(), 'piper');
	const requireFn = deps.requireFn ?? defaultRequire;
	const storage = new PiperStorage({
		dir,
		fs: deps.fs ?? (fs.promises as unknown as FsLike),
		fetchFn: deps.fetchFn ?? defaultFetch,
		catalogUrl: async () => (await readSettings()).piperCatalogUrl,
	});
	const synthesizer = new PiperSynthesizer({
		voices: storage,
		loadRuntime: async (): Promise<PiperRuntime> => {
			await storage.ensureRuntime();
			return {
				ort: requireFn(storage.runtimePath('ort.wasm.min.js')) as OrtLike,
				createPhonemizer: requireFn(storage.runtimePath('piper_phonemize.js')) as CreatePhonemizer,
				runtimeDir: storage.runtimeDir,
			};
		},
	});

	return {
		storage,
		controller: new PiperDialogController(storage),

		async voices() {
			const installed = await storage.installed();
			return {
				voices: installed.map((v) => ({
					id: v.id,
					name: `${v.name} (${v.language.replace('_', '-')}, ${v.quality})`,
					lang: v.language.replace('_', '-'),
				})),
			};
		},

		async hasVoices() {
			return (await storage.installed()).length > 0;
		},

		async synthesize(text, voiceId) {
			try {
				const installed = (await storage.installed()).map((v) => v.id);
				const saved = (await readSettings()).voice;
				const id =
					[voiceId, saved].find((candidate) => installed.includes(candidate)) ?? installed[0];
				if (!id) {
					return {
						ok: false,
						error:
							'No Piper voice is downloaded. Choose one in Tools > Joplin Text-to-Speech: Piper voices.',
					};
				}
				return { ok: true, wav: await synthesizer.synthesize(id, text) };
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}
