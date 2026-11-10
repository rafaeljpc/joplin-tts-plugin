#!/usr/bin/env node
/**
 * Sets the plugin version in package.json, package-lock.json and
 * src/manifest.json at once:
 *
 *   npm run version:set -- 0.3.0-dev   # start of development of 0.3.0
 *   npm run version:set -- 0.3.0       # release branch, before merging into main
 *
 * A `-dev` version makes local packages identifiable (Joplin shows it in the
 * plugin list). The release workflow refuses to publish a `-dev` version.
 */
const fs = require('fs');
const path = require('path');

const VERSION = /^\d+\.\d+\.\d+(-dev)?$/;

/** Replaces the first `"version": "<from>"` of a JSON text, keeping its formatting. */
function replaceVersion(text, from, to, count = 1) {
	const pattern = `"version": "${from}"`;
	let result = text;
	let index = 0;
	for (let i = 0; i < count; i++) {
		index = result.indexOf(pattern, index);
		if (index === -1) throw new Error(`Could not find ${pattern}`);
		result = result.slice(0, index) + `"version": "${to}"` + result.slice(index + pattern.length);
		index += `"version": "${to}"`.length;
	}
	return result;
}

function setVersion(dir, version) {
	if (!VERSION.test(version || '')) {
		throw new Error(`Invalid version "${version}": use X.Y.Z or X.Y.Z-dev`);
	}
	const files = {
		packageJson: path.join(dir, 'package.json'),
		lock: path.join(dir, 'package-lock.json'),
		manifest: path.join(dir, 'src', 'manifest.json'),
	};
	const current = JSON.parse(fs.readFileSync(files.packageJson, 'utf8')).version;
	const manifestVersion = JSON.parse(fs.readFileSync(files.manifest, 'utf8')).version;
	if (current !== manifestVersion) {
		throw new Error(`package.json (${current}) and manifest.json (${manifestVersion}) differ`);
	}
	// package-lock.json repeats the version for the root and for the "" package.
	const edits = [
		[files.packageJson, 1],
		[files.lock, 2],
		[files.manifest, 1],
	];
	for (const [file, count] of edits) {
		fs.writeFileSync(file, replaceVersion(fs.readFileSync(file, 'utf8'), current, version, count));
	}
	return { from: current, to: version };
}

module.exports = { setVersion, replaceVersion, VERSION };

if (require.main === module) {
	try {
		const { from, to } = setVersion(process.cwd(), process.argv[2]);
		console.info(`Version ${from} -> ${to}`);
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
