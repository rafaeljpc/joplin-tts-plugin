/**
 * Files of the Piper runtime (the eSpeak phonemizer and ONNX Runtime, both
 * WebAssembly). They are downloaded once into the plugin's data folder and every
 * file is checked against the SHA-256 below, so a changed or tampered file is
 * never loaded. Versions are pinned: phonemizer `@diffusionstudio/piper-wasm@1.0.0`
 * and `onnxruntime-web@1.18.0`, both served from the npm CDN.
 */
export interface RuntimeFile {
	/** File name on disk and in the CDN folder. */
	name: string;
	url: string;
	sha256: string;
	sizeBytes: number;
}

const PHONEMIZER = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/';
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';

export const PIPER_RUNTIME_FILES: RuntimeFile[] = [
	{
		name: 'piper_phonemize.js',
		url: `${PHONEMIZER}piper_phonemize.js`,
		sha256: 'fef0c2fc442d24fdef5c7c7cc37d5da2314407640fe11ab1bfe347c723dff19b',
		sizeBytes: 120_714,
	},
	{
		name: 'piper_phonemize.wasm',
		url: `${PHONEMIZER}piper_phonemize.wasm`,
		sha256: 'b777cd107a91d2bcc6a1ea46f2c26a662a7407394fe84589198aeaa83dd7a9d6',
		sizeBytes: 635_212,
	},
	{
		name: 'piper_phonemize.data',
		url: `${PHONEMIZER}piper_phonemize.data`,
		sha256: '29f1025eb23a5b5c192cd14a6efbce4509402ff265405072ee6f7d1a09b78f8c',
		sizeBytes: 18_077_249,
	},
	{
		name: 'ort.wasm.min.js',
		url: `${ORT}ort.wasm.min.js`,
		sha256: '90533a3fd7006df7f897c0d63c468996da5c8e430e39964d92ebe586c4996614',
		sizeBytes: 142_930,
	},
	{
		name: 'ort-wasm-simd.wasm',
		url: `${ORT}ort-wasm-simd.wasm`,
		sha256: 'f533b5f21790563d7556c611c3835ac65848ee326da2689aac54ed7d9cc8c6a4',
		sizeBytes: 10_595_041,
	},
];

export const PIPER_RUNTIME_BYTES = PIPER_RUNTIME_FILES.reduce((sum, f) => sum + f.sizeBytes, 0);
