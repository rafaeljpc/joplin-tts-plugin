import fs from 'fs';
import os from 'os';
import path from 'path';

const script = require('../.github/scripts/set-version.cjs');

describe('set-version script', () => {
	let dir: string;
	const read = (...parts: string[]) => fs.readFileSync(path.join(dir, ...parts), 'utf8');

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-version-'));
		fs.mkdirSync(path.join(dir, 'src'));
		fs.writeFileSync(
			path.join(dir, 'package.json'),
			'{\n  "name": "x",\n  "version": "0.2.0"\n}\n',
		);
		fs.writeFileSync(
			path.join(dir, 'package-lock.json'),
			'{\n  "name": "x",\n  "version": "0.2.0",\n  "packages": {\n    "": {\n      "version": "0.2.0"\n    },\n    "node_modules/y": {\n      "version": "0.2.0"\n    }\n  }\n}\n',
		);
		fs.writeFileSync(path.join(dir, 'src', 'manifest.json'), '{\n\t"version": "0.2.0"\n}');
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	it('sets the version everywhere, keeping formatting and other packages untouched', () => {
		expect(script.setVersion(dir, '0.3.0-dev')).toEqual({ from: '0.2.0', to: '0.3.0-dev' });
		expect(JSON.parse(read('package.json')).version).toBe('0.3.0-dev');
		expect(JSON.parse(read('src', 'manifest.json')).version).toBe('0.3.0-dev');
		const lock = JSON.parse(read('package-lock.json'));
		expect(lock.version).toBe('0.3.0-dev');
		expect(lock.packages[''].version).toBe('0.3.0-dev');
		expect(lock.packages['node_modules/y'].version).toBe('0.2.0');
		expect(read('src', 'manifest.json')).toBe('{\n\t"version": "0.3.0-dev"\n}');
	});

	it('can turn a dev version into the release version', () => {
		script.setVersion(dir, '0.3.0-dev');
		script.setVersion(dir, '0.3.0');
		expect(JSON.parse(read('package.json')).version).toBe('0.3.0');
	});

	it('rejects invalid versions', () => {
		expect(() => script.setVersion(dir, 'latest')).toThrow('Invalid version');
		expect(() => script.setVersion(dir, undefined)).toThrow('Invalid version');
		expect(() => script.setVersion(dir, '1.0')).toThrow('Invalid version');
		expect(() => script.setVersion(dir, '1.0.0-beta')).toThrow('Invalid version');
	});

	it('refuses to run when package.json and the manifest disagree', () => {
		fs.writeFileSync(path.join(dir, 'src', 'manifest.json'), '{\n\t"version": "0.1.0"\n}');
		expect(() => script.setVersion(dir, '0.3.0')).toThrow('differ');
	});

	it('fails when a file does not contain the version', () => {
		fs.writeFileSync(path.join(dir, 'package-lock.json'), '{ "version": "0.2.0" }');
		expect(() => script.setVersion(dir, '0.3.0')).toThrow('Could not find');
	});
});
