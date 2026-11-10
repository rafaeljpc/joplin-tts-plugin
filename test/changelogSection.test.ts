import fs from 'fs';
import os from 'os';
import path from 'path';

const script = require('../.github/scripts/changelog-section.cjs');

const changelog = [
	'# Changelog',
	'',
	'## [Unreleased]',
	'',
	'## [0.2.0] - 2026-11-10',
	'',
	'### Added',
	'',
	'- Prefetch.',
	'',
	'## [0.1.0] - 2026-11-09',
	'',
	'- First.',
	'',
	'## [0.0.1] - 2026-01-01',
].join('\n');

describe('changelog-section script', () => {
	it('returns the body of a version, up to the next section', () => {
		expect(script.extractSection(changelog, '0.2.0')).toBe('### Added\n\n- Prefetch.\n');
		expect(script.extractSection(changelog, '0.1.0')).toBe('- First.\n');
	});

	it('handles CRLF files and a version that is not matched as a regex', () => {
		expect(script.extractSection(changelog.replace(/\n/g, '\r\n'), '0.2.0')).toContain(
			'- Prefetch.',
		);
		expect(() => script.extractSection(changelog, '0x2x0')).toThrow('no section for 0x2x0');
	});

	it('fails when the section is missing or empty', () => {
		expect(() => script.extractSection(changelog, '9.9.9')).toThrow('no section for 9.9.9');
		expect(() => script.extractSection(changelog, '0.0.1')).toThrow('is empty');
		expect(() => script.extractSection(changelog, 'Unreleased')).toThrow('is empty');
	});

	describe('main', () => {
		let dir: string;
		beforeEach(() => {
			dir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-'));
		});
		afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

		it('reads the given file', () => {
			const file = path.join(dir, 'CHANGELOG.md');
			fs.writeFileSync(file, changelog);
			expect(script.main(['0.1.0', file])).toBe('- First.\n');
		});

		it('defaults to CHANGELOG.md in the working directory', () => {
			const cwd = process.cwd();
			fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), changelog);
			process.chdir(dir);
			try {
				expect(script.main(['0.2.0'])).toContain('Prefetch');
			} finally {
				process.chdir(cwd);
			}
		});

		it('requires a version', () => {
			expect(() => script.main([])).toThrow('Usage');
		});
	});
});
