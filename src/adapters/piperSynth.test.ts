import * as fs from 'fs';
import * as os from 'os';
import * as nodePath from 'path';
import { OrtLike, PiperRuntime, PiperSynthesizer } from './piperSynth';
import { PiperVoiceConfig } from '../domain/piperVoiceConfig';
import { PIPER_RUNTIME_FILES } from '../domain/piperRuntime';

class FakeTensor {
	constructor(
		public type: string,
		public data: ArrayLike<unknown>,
		public dims?: number[],
	) {}
}

const CONFIG: PiperVoiceConfig = {
	audio: { sample_rate: 22050 },
	espeak: { voice: 'pt-br' },
	inference: { noise_scale: 0.667, length_scale: 1, noise_w: 0.8 },
	speaker_id_map: {},
};

function setup(config: PiperVoiceConfig = CONFIG, phonemizerOutput?: (o: Hooks) => void) {
	const run = jest.fn(async () => ({ output: { data: Float32Array.from([0, 0.5, -0.5]) } }));
	const create = jest.fn(async () => ({ run }));
	const ort = {
		env: { wasm: {} as { wasmPaths?: string; numThreads?: number } },
		InferenceSession: { create },
		Tensor: FakeTensor,
	};
	const callMain = jest.fn();
	const createPhonemizer = jest.fn(async (hooks: Hooks) => ({
		callMain: (args: string[]) => {
			callMain(args);
			(phonemizerOutput ?? ((h) => h.print(JSON.stringify({ phoneme_ids: [1, 2, 3] }))))(hooks);
		},
	}));
	const runtime = { ort, createPhonemizer, runtimeDir: nodePath.join('data', 'runtime') };
	const loadRuntime = jest.fn(async () => runtime as unknown as PiperRuntime);
	const readVoice = jest.fn(async () => ({ model: Uint8Array.from([1]), config }));
	const synth = new PiperSynthesizer({ voices: { readVoice }, loadRuntime });
	return { synth, run, create, ort, createPhonemizer, callMain, loadRuntime, readVoice, runtime };
}
type Hooks = {
	print: (line: string) => void;
	printErr: (line: string) => void;
	locateFile: (file: string) => string;
};

const decode = (base64: string) => Uint8Array.from(Buffer.from(base64, 'base64'));

describe('PiperSynthesizer', () => {
	it('speaks a sentence: phonemizes, runs the voice and returns a WAV in base64', async () => {
		const { synth, run, callMain } = setup();
		const wav = decode(await synth.synthesize('pt_BR-faber-medium', '  Olá mundo.  '));

		expect(callMain).toHaveBeenCalledWith([
			'-l',
			'pt-br',
			'--input',
			JSON.stringify([{ text: 'Olá mundo.' }]),
			'--espeak_data',
			'/espeak-ng-data',
		]);
		const feeds = (run.mock.calls[0] as unknown as [Record<string, FakeTensor>])[0];
		expect(Object.keys(feeds)).toEqual(['input', 'input_lengths', 'scales']);
		expect(feeds.input.dims).toEqual([1, 3]);
		expect(Array.from(feeds.input.data as BigInt64Array)).toEqual([
			BigInt(1),
			BigInt(2),
			BigInt(3),
		]);
		expect(Array.from(feeds.input_lengths.data as BigInt64Array)).toEqual([BigInt(3)]);
		expect(Array.from(feeds.scales.data as Float32Array).map((n) => Number(n.toFixed(3)))).toEqual([
			0.667, 1, 0.8,
		]);
		expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF');
		expect(new DataView(wav.buffer).getUint32(24, true)).toBe(22050);
		expect(wav.length).toBe(44 + 3 * 2);
	});

	it('passes a speaker id to multi-speaker voices', async () => {
		const { synth, run } = setup({ ...CONFIG, speaker_id_map: { a: 0, b: 1 } });
		await synth.synthesize('v', 'x');
		const feeds = (run.mock.calls[0] as unknown as [Record<string, FakeTensor>])[0];
		expect(Object.keys(feeds)).toContain('sid');
	});

	it('treats a missing speaker map as a single speaker', async () => {
		const { synth, run } = setup({ ...CONFIG, speaker_id_map: undefined });
		await synth.synthesize('v', 'x');
		const feeds = (run.mock.calls[0] as unknown as [Record<string, FakeTensor>])[0];
		expect(Object.keys(feeds)).not.toContain('sid');
	});

	it('configures the runtime once and finds its files in the runtime folder', async () => {
		const { synth, ort, loadRuntime, createPhonemizer } = setup();
		await synth.synthesize('v', 'a');
		await synth.synthesize('v', 'b');
		expect(loadRuntime).toHaveBeenCalledTimes(1);
		expect(ort.env.wasm).toEqual({
			wasmPaths: nodePath.join('data', 'runtime') + nodePath.sep,
			numThreads: 1,
		});
		const hooks = createPhonemizer.mock.calls[0][0];
		expect(hooks.locateFile('piper_phonemize.wasm')).toBe(
			nodePath.join('data', 'runtime', 'piper_phonemize.wasm'),
		);
	});

	it('loads a voice once and loads again when the voice changes', async () => {
		const { synth, readVoice, create } = setup();
		await synth.synthesize('v1', 'a');
		await synth.synthesize('v1', 'b');
		expect(create).toHaveBeenCalledTimes(1);
		await synth.synthesize('v2', 'c');
		expect(readVoice).toHaveBeenCalledTimes(2);
		expect(create).toHaveBeenCalledTimes(2);
	});

	it('explains why phonemizing failed', async () => {
		const withError = setup(CONFIG, (h) => h.printErr('espeak: voice not found'));
		await expect(withError.synth.synthesize('v', 'x')).rejects.toThrow('voice not found');

		const silent = setup(CONFIG, () => undefined);
		await expect(silent.synth.synthesize('v', 'x')).rejects.toThrow('no phonemes');

		const empty = setup(CONFIG, (h) => h.print(JSON.stringify({ phoneme_ids: [] })));
		await expect(empty.synth.synthesize('v', 'x')).rejects.toThrow('no phonemes');

		const odd = setup(CONFIG, (h) => h.print(JSON.stringify({ phoneme_ids: 'x' })));
		await expect(odd.synth.synthesize('v', 'x')).rejects.toThrow('no phonemes');
	});

	it('retries loading the runtime after a failure', async () => {
		const { synth, loadRuntime, runtime } = setup();
		loadRuntime.mockRejectedValueOnce(new Error('no network'));
		await expect(synth.synthesize('v', 'x')).rejects.toThrow('no network');
		loadRuntime.mockResolvedValue(runtime as unknown as PiperRuntime);
		await expect(synth.synthesize('v', 'x')).resolves.toEqual(expect.any(String));
	});

	it('runs requests one at a time and survives a failed one', async () => {
		const { synth, run } = setup();
		const order: string[] = [];
		let release: () => void = () => undefined;
		run.mockImplementationOnce(async () => {
			order.push('first start');
			await new Promise<void>((resolve) => (release = resolve));
			order.push('first end');
			return { output: { data: Float32Array.from([0]) } };
		});
		const first = synth.synthesize('v', 'one');
		const second = synth.synthesize('v', 'two');
		run.mockImplementationOnce(async () => {
			order.push('second');
			throw new Error('boom');
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(order).toEqual(['first start']);
		release();
		await first;
		await expect(second).rejects.toThrow('boom');
		await expect(synth.synthesize('v', 'three')).resolves.toEqual(expect.any(String));
		expect(order).toEqual(['first start', 'first end', 'second']);
	});
});

/**
 * Regression: in Joplin, Piper failed with "Cannot read properties of undefined
 * (reading 'wasm')". onnxruntime-web ships `dist/ort.wasm.min.js` as a browser IIFE,
 * `"use strict";var ort=(()=>{...;return Je(to);})();`, which never touches
 * `module.exports`: `require()` returns `{}` (the `var` is local to the module
 * wrapper, so not even `globalThis.ort` is set). `dist/cjs/ort.wasm.min.js` is the
 * same bundle ending in `module.exports=Je(to);`. The stand-ins below keep those
 * real wrappers (and the esbuild namespace: getters plus `__esModule`/`default`).
 */
describe('PiperSynthesizer with the real shapes of the ONNX Runtime script', () => {
	const NAMESPACE = `
		var Tensor = class { constructor(type, data, dims) { this.type = type; this.data = data; this.dims = dims; } };
		var session = { run: async () => ({ output: { data: Float32Array.from([0]) } }) };
		var G = { wasm: {} };
		var to = {};
		Object.defineProperty(to, '__esModule', { value: true });
		for (const [k, get] of Object.entries({
			env: () => G,
			InferenceSession: () => ({ create: async () => session }),
			Tensor: () => Tensor,
			default: () => G,
		})) Object.defineProperty(to, k, { get, enumerable: true });`;
	const SHAPES = {
		iife: `"use strict";var ort=(()=>{${NAMESPACE}\nreturn to;})();`,
		cjs: `"use strict";${NAMESPACE}\nmodule.exports=to;`,
	};
	let dir: string;
	beforeAll(() => {
		dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'ort-shape-'));
		for (const [name, source] of Object.entries(SHAPES)) {
			fs.writeFileSync(nodePath.join(dir, `${name}.js`), source);
		}
	});
	afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

	const synthWith = (shape: keyof typeof SHAPES) => {
		const ort = require(nodePath.join(dir, `${shape}.js`)) as OrtLike;
		const createPhonemizer = async (hooks: Hooks) => ({
			callMain: () => hooks.print(JSON.stringify({ phoneme_ids: [1] })),
		});
		const runtime = { ort, createPhonemizer, runtimeDir: dir } as PiperRuntime;
		const readVoice = async () => ({ model: Uint8Array.from([1]), config: CONFIG });
		return {
			ort,
			synth: new PiperSynthesizer({ voices: { readVoice }, loadRuntime: async () => runtime }),
		};
	};

	it('the browser (IIFE) build exports nothing to require(), so it is reported clearly', async () => {
		const { ort, synth } = synthWith('iife');
		expect(ort).toEqual({});
		expect((globalThis as { ort?: unknown }).ort).toBeUndefined();
		// Before the fix this was the TypeError seen in Joplin.
		await expect(synth.synthesize('v', 'x')).rejects.toThrow(
			'The ONNX Runtime script did not load (it exports no `env.wasm`)',
		);
	});

	it('the CommonJS build exports ONNX Runtime and speaks', async () => {
		const { ort, synth } = synthWith('cjs');
		await expect(synth.synthesize('v', 'x')).resolves.toEqual(expect.any(String));
		expect(ort.env.wasm).toEqual({ wasmPaths: dir + nodePath.sep, numThreads: 1 });
	});

	it('downloads the CommonJS build of ONNX Runtime', () => {
		const script = PIPER_RUNTIME_FILES.find((f) => f.name === 'ort.wasm.min.js');
		expect(script?.url).toBe(
			'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/cjs/ort.wasm.min.js',
		);
	});
});
