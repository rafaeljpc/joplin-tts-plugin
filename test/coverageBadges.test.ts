import fs from 'fs';
import os from 'os';
import path from 'path';

const script = require('../.github/scripts/coverage-badges.cjs');

const metric = (pct: number) => ({ total: 10, covered: Math.round(pct / 10), pct });
const summary = {
	total: {
		lines: metric(100),
		statements: metric(100),
		functions: metric(100),
		branches: metric(80),
	},
};

describe('coverage-badges script', () => {
	let dir: string;
	let summaryPath: string;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-'));
		summaryPath = path.join(dir, 'coverage-summary.json');
		fs.writeFileSync(summaryPath, JSON.stringify(summary));
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	it.each([
		[100, '#4c1'],
		[95, '#4c1'],
		[92, '#97ca00'],
		[85, '#dfb317'],
		[10, '#e05d44'],
	])('colors %s%% as %s', (value, expected) => {
		expect(script.color(value)).toBe(expected);
	});

	it('renders an accessible SVG badge', () => {
		const svg = script.badgeSvg('coverage', 99.5);
		expect(svg).toContain('aria-label="coverage: 99.5%"');
		expect(svg).toContain('#4c1');
	});

	it('writes both badges and returns a markdown summary', () => {
		const badges = path.join(dir, 'out', 'badges');
		const md = script.run(summaryPath, badges);
		expect(fs.readFileSync(path.join(badges, 'coverage.svg'), 'utf8')).toContain(
			'coverage: 100.0%',
		);
		expect(fs.readFileSync(path.join(badges, 'branches.svg'), 'utf8')).toContain('branches: 80.0%');
		expect(md).toContain('| Branches | 80% | 8 | 2 |');
	});

	it('only returns markdown when no badge directory is given', () => {
		const md = script.run(summaryPath);
		expect(md).toContain('## Test coverage (Jest)');
		expect(fs.existsSync(path.join(dir, 'badges'))).toBe(false);
	});

	it('parses CLI arguments', () => {
		const badges = path.join(dir, 'cli');
		const md = script.main([summaryPath, '--badges', badges]);
		expect(md).toContain('Lines');
		expect(fs.existsSync(path.join(badges, 'coverage.svg'))).toBe(true);
	});

	it('falls back to coverage/coverage-summary.json in the working directory', () => {
		const cwd = process.cwd();
		process.chdir(dir);
		try {
			expect(() => script.main([])).toThrow();
			fs.mkdirSync('coverage');
			fs.copyFileSync(summaryPath, path.join('coverage', 'coverage-summary.json'));
			expect(script.main([])).toContain('Statements');
		} finally {
			process.chdir(cwd);
		}
	});
});
