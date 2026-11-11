/** @jest-environment node */
import { loadOrt } from './ortLoader';

describe('loadOrt', () => {
	it('evaluates the script like a web worker: no process, fetch serves the wasm bytes', async () => {
		const source = `
			module.exports = {
				sawProcess: typeof process !== 'undefined',
				sawRequire: typeof require !== 'undefined',
				fetchWasm: () => fetch('ort-wasm-simd.wasm').then((r) => [r.headers.get('Content-Type'), r.arrayBuffer()]),
				importScripts: typeof importScripts,
				noop: importScripts(),
				href: self.location.href,
			};`;
		const ort = loadOrt(source, Uint8Array.from([0, 97, 115, 109])) as unknown as {
			sawProcess: boolean;
			sawRequire: boolean;
			fetchWasm: () => Promise<[string, Promise<ArrayBuffer>]>;
			importScripts: string;
			noop: undefined;
			href: string;
		};
		expect(ort.sawProcess).toBe(false);
		expect(ort.sawRequire).toBe(false);
		expect(ort.importScripts).toBe('function');
		expect(ort.noop).toBeUndefined();
		expect(ort.href).toBe('https://ort.local/');
		const [type, bytes] = await ort.fetchWasm();
		expect(type).toBe('application/wasm');
		expect(Array.from(new Uint8Array(await bytes))).toEqual([0, 97, 115, 109]);
	});
});
