import { OrtLike } from './piperSynth';

/**
 * Loads the ONNX Runtime script (`ort.wasm.min.js`) inside the plugin process.
 *
 * That file is a browser bundle: when it sees Node (`process`) it reads files with
 * `path` and `fs`, which the bundler replaced with empty stubs (`path.normalize is
 * not a function`). So it is evaluated as if in a web worker instead: `process` is
 * hidden from it and `fetch` is answered with the bytes of the `.wasm` file, which
 * is how the browser build is meant to load it.
 */
export function loadOrt(source: string, wasmBytes: Uint8Array): OrtLike {
	const module = { exports: {} as unknown };
	const serveWasm = async () =>
		new Response(wasmBytes as unknown as BodyInit, {
			headers: { 'Content-Type': 'application/wasm' },
		});
	const run = new Function(
		'module',
		'exports',
		'process',
		'importScripts',
		'self',
		'require',
		'__filename',
		'__dirname',
		'fetch',
		source,
	);
	run(
		module,
		module.exports,
		undefined,
		() => undefined,
		{ location: { href: 'https://ort.local/' } },
		undefined,
		undefined,
		undefined,
		serveWasm,
	);
	return module.exports as OrtLike;
}
