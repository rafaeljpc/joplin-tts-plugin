import { VIEWER_SCRIPT_ID } from '../application/ids';
import { createViewerHighlighter, detectHighlightEnv } from './viewerHighlight';

export interface ViewerApi {
	postMessage(contentScriptId: string, message: unknown): Promise<unknown>;
}

/**
 * Reports the text selected in the rendered note to the plugin. Selection
 * changes are debounced because the browser fires them continuously while the
 * user drags the mouse.
 */
export function trackViewerSelection(doc: Document, api: ViewerApi, delayMs = 150): void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	doc.addEventListener('selectionchange', () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			const selection = doc.getSelection()?.toString() ?? '';
			Promise.resolve(api.postMessage(VIEWER_SCRIPT_ID, { source: 'viewer', selection })).catch(
				() => undefined,
			);
		}, delayMs);
	});
}

/**
 * The plugin cannot push messages into the rendered note, so the note asks for
 * the sentence to highlight at a regular pace. Requests never overlap.
 */
export function pollHighlight(
	api: ViewerApi,
	show: (text: string | null) => void,
	intervalMs = 500,
): void {
	let pending = false;
	setInterval(() => {
		if (pending) return;
		pending = true;
		Promise.resolve(api.postMessage(VIEWER_SCRIPT_ID, { type: 'poll' }))
			.then((reply) =>
				show((reply as { highlight?: string | null } | undefined)?.highlight ?? null),
			)
			.catch(() => undefined)
			.finally(() => {
				pending = false;
			});
	}, intervalMs);
}

declare const webviewApi: ViewerApi | undefined;
if (typeof webviewApi !== 'undefined' && typeof document !== 'undefined') {
	trackViewerSelection(document, webviewApi);
	const env = detectHighlightEnv(window);
	if (env) pollHighlight(webviewApi, createViewerHighlighter(document, env).show);
}
