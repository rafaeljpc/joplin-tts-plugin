#!/usr/bin/env node
/**
 * Prints the CHANGELOG.md section of a version, to be used as the release
 * notes: `node .github/scripts/changelog-section.cjs 0.3.0 > notes.md`.
 * Fails when the section is missing or empty, which stops a release that
 * forgot to document its changes.
 */
const fs = require('fs');

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function extractSection(changelog, version) {
	const lines = changelog.replace(/\r\n/g, '\n').split('\n');
	const header = new RegExp(`^## \\[${escapeRegExp(version)}\\]`);
	const start = lines.findIndex((line) => header.test(line));
	if (start === -1) throw new Error(`CHANGELOG.md has no section for ${version}`);
	const next = lines.findIndex((line, index) => index > start && line.startsWith('## '));
	const body = lines
		.slice(start + 1, next === -1 ? undefined : next)
		.join('\n')
		.trim();
	if (!body) throw new Error(`The CHANGELOG.md section for ${version} is empty`);
	return `${body}\n`;
}

function main(argv) {
	const [version, file = 'CHANGELOG.md'] = argv;
	if (!version) throw new Error('Usage: changelog-section.cjs <version> [changelog-file]');
	return extractSection(fs.readFileSync(file, 'utf8'), version);
}

module.exports = { extractSection, main };

if (require.main === module) {
	try {
		process.stdout.write(main(process.argv.slice(2)));
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
