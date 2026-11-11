import { createHash } from 'crypto';
import * as nodePath from 'path';
import { InstalledVoice, PiperStore } from '../application/piperStore';
import {
	catalogFileUrl,
	parsePiperCatalog,
	PIPER_CATALOG_FILE,
	PiperVoice,
} from '../domain/piperCatalog';
import { PIPER_RUNTIME_FILES, RuntimeFile } from '../domain/piperRuntime';
import { PiperVoiceConfig } from '../domain/piperVoiceConfig';

/** The subset of `fs.promises` used here (so tests can use a memory file system). */
export interface FsLike {
	mkdir(path: string, options: { recursive: true }): Promise<unknown>;
	readdir(path: string): Promise<string[]>;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, data: Uint8Array | string): Promise<void>;
	rename(from: string, to: string): Promise<void>;
	rm(path: string, options: { recursive: true; force: true }): Promise<void>;
	stat(path: string): Promise<{ size: number }>;
}

export type FetchFn = (url: string) => Promise<Response>;

export interface PiperStorageOptions {
	/** Folder owned by the plugin (Joplin's plugin data folder + `piper`). */
	dir: string;
	fs: FsLike;
	fetchFn: FetchFn;
	catalogUrl: () => Promise<string> | string;
}

const MODEL = 'model.onnx';
const CONFIG = 'model.onnx.json';
const META = 'meta.json';

/** Voice ids become folder names, so only plain names are accepted. */
const SAFE_ID = /^[A-Za-z0-9_]+(?:[-.][A-Za-z0-9_]+)*$/;

const assertSafeId = (id: string): void => {
	if (!SAFE_ID.test(id)) throw new Error(`Invalid voice id: ${id}`);
};

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/**
 * Keeps the Piper runtime and the voices in a local folder:
 *
 *   <dir>/runtime/<file>           WebAssembly runtime (checked against SHA-256)
 *   <dir>/voices/<id>/model.onnx   the voice, with model.onnx.json and meta.json
 *
 * A voice only counts as downloaded when `meta.json`, written last, exists.
 */
export class PiperStorage implements PiperStore {
	private runtimeReady: Promise<void> | null = null;

	constructor(private options: PiperStorageOptions) {}

	get runtimeDir(): string {
		return nodePath.join(this.options.dir, 'runtime');
	}

	private voiceDir(id: string): string {
		assertSafeId(id);
		return nodePath.join(this.options.dir, 'voices', id);
	}

	async fetchCatalog(): Promise<PiperVoice[]> {
		const url = catalogFileUrl(await this.options.catalogUrl(), PIPER_CATALOG_FILE);
		const response = await this.options.fetchFn(url);
		if (!response.ok) throw new Error(`Voice catalog error ${response.status}: ${url}`);
		const voices = parsePiperCatalog(await response.json());
		if (voices.length === 0) throw new Error(`The voice catalog at ${url} lists no voices`);
		return voices;
	}

	async installed(): Promise<InstalledVoice[]> {
		const root = nodePath.join(this.options.dir, 'voices');
		const names = await this.options.fs.readdir(root).catch(() => [] as string[]);
		const voices: InstalledVoice[] = [];
		for (const name of names) {
			const voice = await this.readMeta(name);
			if (voice) voices.push(voice);
		}
		return voices.sort((a, b) => a.id.localeCompare(b.id));
	}

	private async readMeta(name: string): Promise<InstalledVoice | null> {
		if (!SAFE_ID.test(name)) return null;
		try {
			const dir = this.voiceDir(name);
			const meta = JSON.parse(await this.readText(nodePath.join(dir, META))) as InstalledVoice;
			await this.options.fs.stat(nodePath.join(dir, MODEL));
			await this.options.fs.stat(nodePath.join(dir, CONFIG));
			return meta.id === name ? meta : null;
		} catch {
			return null;
		}
	}

	async download(
		voice: PiperVoice,
		onProgress: (loaded: number, total: number) => void,
	): Promise<void> {
		const dir = this.voiceDir(voice.id);
		const missing = await this.missingRuntime();
		const total = voice.sizeBytes + missing.reduce((sum, f) => sum + f.sizeBytes, 0);
		let loaded = 0;
		const count = (bytes: number) => {
			loaded += bytes;
			onProgress(loaded, total);
		};
		onProgress(0, total);
		await this.downloadRuntime(missing, count);
		try {
			await this.options.fs.mkdir(dir, { recursive: true });
			for (const file of voice.files) {
				const target = file.path.endsWith('.json') ? CONFIG : MODEL;
				const bytes = await this.fetchBytes(
					catalogFileUrl(await this.options.catalogUrl(), file.path),
					count,
				);
				if (file.sizeBytes > 0 && bytes.length !== file.sizeBytes) {
					throw new Error(`Incomplete download of ${file.path}`);
				}
				await this.writeAtomic(nodePath.join(dir, target), bytes);
			}
			const meta: InstalledVoice = {
				id: voice.id,
				name: voice.name,
				language: voice.language,
				quality: voice.quality,
				sizeBytes: voice.sizeBytes,
			};
			await this.options.fs.writeFile(nodePath.join(dir, META), JSON.stringify(meta));
		} catch (error) {
			await this.options.fs.rm(dir, { recursive: true, force: true });
			throw error;
		}
	}

	async remove(voiceId: string): Promise<void> {
		await this.options.fs.rm(this.voiceDir(voiceId), { recursive: true, force: true });
	}

	/** The model and configuration of a downloaded voice. */
	async readVoice(voiceId: string): Promise<{ model: Uint8Array; config: PiperVoiceConfig }> {
		const dir = this.voiceDir(voiceId);
		const [model, config] = await Promise.all([
			this.options.fs.readFile(nodePath.join(dir, MODEL)),
			this.readText(nodePath.join(dir, CONFIG)),
		]);
		return { model, config: JSON.parse(config) as PiperVoiceConfig };
	}

	runtimePath(name: string): string {
		return nodePath.join(this.runtimeDir, name);
	}

	/** Downloads the runtime files that are missing or have the wrong size. */
	ensureRuntime(): Promise<void> {
		this.runtimeReady ??= this.missingRuntime()
			.then((missing) => this.downloadRuntime(missing, () => undefined))
			.catch((error: unknown) => {
				this.runtimeReady = null; // retry next time
				throw error;
			});
		return this.runtimeReady;
	}

	private async missingRuntime(): Promise<RuntimeFile[]> {
		const missing: RuntimeFile[] = [];
		for (const file of PIPER_RUNTIME_FILES) {
			const size = await this.options.fs
				.stat(this.runtimePath(file.name))
				.then((s) => s.size)
				.catch(() => -1);
			if (size !== file.sizeBytes) missing.push(file);
		}
		return missing;
	}

	private async downloadRuntime(
		files: RuntimeFile[],
		count: (bytes: number) => void,
	): Promise<void> {
		if (files.length === 0) return;
		await this.options.fs.mkdir(this.runtimeDir, { recursive: true });
		for (const file of files) {
			const bytes = await this.fetchBytes(file.url, count);
			if (sha256(bytes) !== file.sha256) {
				throw new Error(`The downloaded ${file.name} does not match the expected checksum`);
			}
			await this.writeAtomic(this.runtimePath(file.name), bytes);
		}
	}

	private async readText(path: string): Promise<string> {
		return Buffer.from(await this.options.fs.readFile(path)).toString('utf8');
	}

	private async writeAtomic(path: string, bytes: Uint8Array): Promise<void> {
		await this.options.fs.writeFile(`${path}.part`, bytes);
		await this.options.fs.rename(`${path}.part`, path);
	}

	private async fetchBytes(url: string, onChunk: (bytes: number) => void): Promise<Uint8Array> {
		const response = await this.options.fetchFn(url);
		if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}): ${url}`);
		const reader = response.body?.getReader();
		if (!reader) {
			const bytes = new Uint8Array(await response.arrayBuffer());
			onChunk(bytes.length);
			return bytes;
		}
		const chunks: Uint8Array[] = [];
		let length = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			length += value.length;
			onChunk(value.length);
		}
		const bytes = new Uint8Array(length);
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.length;
		}
		return bytes;
	}
}
