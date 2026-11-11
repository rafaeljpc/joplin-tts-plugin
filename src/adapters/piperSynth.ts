import * as nodePath from 'path';
import { bytesToBase64, pcmToWav } from '../domain/wav';
import { PiperVoiceConfig } from '../domain/piperVoiceConfig';

export interface OrtSession {
	run(feeds: Record<string, unknown>): Promise<{ output: { data: Float32Array } }>;
}

/** The part of `onnxruntime-web` used here. */
export interface OrtLike {
	env: { wasm: { wasmPaths?: string; numThreads?: number } };
	InferenceSession: {
		create(model: Uint8Array, options: { executionProviders: string[] }): Promise<OrtSession>;
	};
	Tensor: new (type: string, data: BigInt64Array | Float32Array, dims?: number[]) => unknown;
}

export interface PhonemizerModule {
	callMain(args: string[]): void;
}

/** The emscripten factory of `piper_phonemize.js`. */
export type CreatePhonemizer = (options: {
	print: (line: string) => void;
	printErr: (line: string) => void;
	locateFile: (file: string) => string;
}) => Promise<PhonemizerModule>;

export interface PiperRuntime {
	ort: OrtLike;
	createPhonemizer: CreatePhonemizer;
	/** Folder holding the runtime files (the WebAssembly files are found there). */
	runtimeDir: string;
}

export interface VoiceSource {
	readVoice(voiceId: string): Promise<{ model: Uint8Array; config: PiperVoiceConfig }>;
}

interface LoadedVoice {
	id: string;
	config: PiperVoiceConfig;
	session: OrtSession;
}

/**
 * Turns a sentence into speech with a downloaded Piper voice, entirely offline:
 * eSpeak (WebAssembly) phonemizes the text, the voice (ONNX) produces the audio.
 * Requests are queued because one ONNX session cannot run two inferences at once.
 */
export class PiperSynthesizer {
	private runtime: Promise<PiperRuntime> | null = null;
	private voice: LoadedVoice | null = null;
	private queue: Promise<unknown> = Promise.resolve();

	constructor(
		private deps: {
			voices: VoiceSource;
			loadRuntime: () => Promise<PiperRuntime>;
		},
	) {}

	/** Base64 of a WAV file with `text` spoken by `voiceId`. */
	synthesize(voiceId: string, text: string): Promise<string> {
		const run = this.queue.then(() => this.run(voiceId, text));
		this.queue = run.catch(() => undefined);
		return run;
	}

	private async run(voiceId: string, text: string): Promise<string> {
		const runtime = await this.loadRuntime();
		const voice = await this.loadVoice(runtime, voiceId);
		const ids = await this.phonemize(runtime, voice.config, text);
		const { ort } = runtime;
		const { inference } = voice.config;
		const feeds: Record<string, unknown> = {
			input: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
			input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)])),
			scales: new ort.Tensor(
				'float32',
				Float32Array.from([inference.noise_scale, inference.length_scale, inference.noise_w]),
			),
		};
		if (Object.keys(voice.config.speaker_id_map ?? {}).length > 0) {
			feeds.sid = new ort.Tensor('int64', BigInt64Array.from([BigInt(0)]));
		}
		const { output } = await voice.session.run(feeds);
		return bytesToBase64(pcmToWav(output.data, voice.config.audio.sample_rate));
	}

	private loadRuntime(): Promise<PiperRuntime> {
		this.runtime ??= this.deps
			.loadRuntime()
			.then((runtime) => {
				runtime.ort.env.wasm.wasmPaths = runtime.runtimeDir + nodePath.sep;
				runtime.ort.env.wasm.numThreads = 1;
				return runtime;
			})
			.catch((error: unknown) => {
				this.runtime = null; // retry next time
				throw error;
			});
		return this.runtime;
	}

	private async loadVoice(runtime: PiperRuntime, voiceId: string): Promise<LoadedVoice> {
		if (this.voice?.id === voiceId) return this.voice;
		const { model, config } = await this.deps.voices.readVoice(voiceId);
		const session = await runtime.ort.InferenceSession.create(model, {
			executionProviders: ['wasm'],
		});
		this.voice = { id: voiceId, config, session };
		return this.voice;
	}

	private async phonemize(
		runtime: PiperRuntime,
		config: PiperVoiceConfig,
		text: string,
	): Promise<number[]> {
		let ids: number[] | null = null;
		let failure: string | null = null;
		const module = await runtime.createPhonemizer({
			print: (line) => {
				const parsed = (JSON.parse(line) as { phoneme_ids?: unknown }).phoneme_ids;
				if (Array.isArray(parsed)) ids = parsed as number[];
			},
			printErr: (line) => {
				failure = line;
			},
			locateFile: (file) => nodePath.join(runtime.runtimeDir, file),
		});
		module.callMain([
			'-l',
			config.espeak.voice,
			'--input',
			JSON.stringify([{ text: text.trim() }]),
			'--espeak_data',
			'/espeak-ng-data',
		]);
		if (!ids || (ids as number[]).length === 0) {
			throw new Error(failure ?? 'The phonemizer produced no phonemes for this text');
		}
		return ids;
	}
}
