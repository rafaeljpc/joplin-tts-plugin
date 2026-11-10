import { VIEWER_SCRIPT_ID } from '../application/ids';

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

declare const webviewApi: ViewerApi | undefined;
if (typeof webviewApi !== 'undefined' && typeof document !== 'undefined') {
	trackViewerSelection(document, webviewApi);
}
