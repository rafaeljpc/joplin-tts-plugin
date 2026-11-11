import { PiperDialogController } from './application/piperDialog';
import { PiperSynthesizeReply, PiperVoicesReply } from './application/messages';
import { FetchFn, FsLike, PiperStorage } from './adapters/piperStorage';
import { loadOrt } from './adapters/ortLoader';
import { CreatePhonemizer, PiperRuntime, PiperSynthesizer } from './adapters/piperSynth';
import { Settings } from './domain/types';

/** Everything Piper needs from the platform; the composition root provides it. */
export interface PiperDeps {
	/** Folder for the runtime and the voices. */
	dir: string;
	fs: FsLike;
	fetchFn: FetchFn;
	/** Loads a downloaded script by its absolute path. */
	requireFn: (id: string) => unknown;
}

/** Offline speech with downloaded Piper voices (plugin side). */
export interface PiperService {
	storage: PiperStorage;
	controller: PiperDialogController;
	/** The voices that are downloaded, as the player lists them. */
	voices(): Promise<PiperVoicesReply>;
	/** True when at least one voice is downloaded. */
	hasVoices(): Promise<boolean>;
	/** True when the voice `id` is downloaded. */
	hasVoice(id: string): Promise<boolean>;
	/** Speaks `text`; an unknown or empty `voiceId` falls back to the saved voice, then to any downloaded one. */
	synthesize(text: string, voiceId: string): Promise<PiperSynthesizeReply>;
}

export function createPiper(readSettings: () => Promise<Settings>, deps: PiperDeps): PiperService {
	const { requireFn } = deps;
	const storage = new PiperStorage({
		dir: deps.dir,
		fs: deps.fs,
		fetchFn: deps.fetchFn,
		catalogUrl: async () => (await readSettings()).piperCatalogUrl,
	});
	const synthesizer = new PiperSynthesizer({
		voices: storage,
		loadRuntime: async (): Promise<PiperRuntime> => {
			await storage.ensureRuntime();
			return {
				ort: loadOrt(
					new TextDecoder().decode(await deps.fs.readFile(storage.runtimePath('ort.wasm.min.js'))),
					await deps.fs.readFile(storage.runtimePath('ort-wasm-simd.wasm')),
				),
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

		async hasVoice(id) {
			return (await storage.installed()).some((v) => v.id === id);
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
