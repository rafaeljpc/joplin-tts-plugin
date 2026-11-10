/**
 * Markdown-it content script. It renders nothing: it only makes Joplin load
 * `webview/viewerSelection.js` into the rendered note, which reports the text
 * the user selects there.
 */
export default function () {
	return {
		plugin: () => undefined,
		assets: () => [{ name: './webview/viewerSelection.js' }],
	};
}
