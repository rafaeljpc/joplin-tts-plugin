#!/usr/bin/env node
/**
 * Reads Jest's coverage/coverage-summary.json and writes shields-style SVG
 * badges (lines and branches) plus a Markdown summary on stdout.
 *
 *   node .github/scripts/coverage-badges.cjs [summary.json] [--badges DIR]
 *
 * Node stdlib only, so it runs on the CI runner without installing anything.
 * Colors follow the 95% branch / 100% line thresholds enforced by Jest.
 */
const fs = require('fs');
const path = require('path');

const color = (value) => {
	if (value >= 95) return '#4c1';
	if (value >= 90) return '#97ca00';
	if (value >= 80) return '#dfb317';
	return '#e05d44';
};

/** Badge in the "flat" shields.io layout, with fixed widths per character. */
function badgeSvg(label, value) {
	const text = `${value.toFixed(1)}%`;
	const labelW = 6 * label.length + 10;
	const valueW = 6 * text.length + 10;
	const totalW = labelW + valueW;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${label}: ${text}">
  <title>${label}: ${text}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#555"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${color(value)}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelW / 2}" y="14">${label}</text>
    <text x="${labelW + valueW / 2}" y="15" fill="#010101" fill-opacity=".3">${text}</text>
    <text x="${labelW + valueW / 2}" y="14">${text}</text>
  </g>
</svg>
`;
}

const METRICS = [
	['lines', 'Lines'],
	['statements', 'Statements'],
	['functions', 'Functions'],
	['branches', 'Branches'],
];

function markdown(total) {
	const rows = METRICS.map(
		([key, label]) =>
			`| ${label} | ${total[key].pct}% | ${total[key].covered} | ${total[key].total - total[key].covered} |`,
	);
	return [
		'## Test coverage (Jest)',
		'',
		'| Metric | Coverage | Covered | Missed |',
		'|---|---:|---:|---:|',
		...rows,
		'',
	].join('\n');
}

/** Writes the badges and returns the Markdown summary. */
function run(summaryPath, badgesDir) {
	const { total } = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
	if (badgesDir) {
		fs.mkdirSync(badgesDir, { recursive: true });
		fs.writeFileSync(path.join(badgesDir, 'coverage.svg'), badgeSvg('coverage', total.lines.pct));
		fs.writeFileSync(
			path.join(badgesDir, 'branches.svg'),
			badgeSvg('branches', total.branches.pct),
		);
	}
	return markdown(total);
}

function main(argv) {
	const badgesIndex = argv.indexOf('--badges');
	const badgesDir = badgesIndex === -1 ? undefined : argv[badgesIndex + 1];
	const positional = argv.filter((a, i) => !a.startsWith('--') && i !== badgesIndex + 1);
	return run(positional[0] || 'coverage/coverage-summary.json', badgesDir);
}

module.exports = { color, badgeSvg, markdown, run, main };

if (require.main === module) {
	process.stdout.write(main(process.argv.slice(2)));
}
