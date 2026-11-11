import { DialogRequest, DialogState } from '../application/piperDialog';
import { DialogToPluginMessage } from '../application/messages';
import { getStrings } from './i18n';
import { createVoicePicker } from './voicePickerView';

/** How often the dialog asks the plugin for the download progress. */
export const DIALOG_POLL_MS = 500;

export interface DialogApiLike {
	postMessage(message: DialogToPluginMessage): Promise<unknown>;
}

/**
 * Joplin fits the dialog to the box it measures, #joplin-plugin-content, and vw/vh would
 * refer to the (tiny) frame itself, so the size comes from the screen: half of its width
 * and height, a quarter of its area. The CSS has a fixed size as a fallback.
 */
export function sizeDialog(doc: Document, screen: { availWidth: number; availHeight: number }) {
	const box = doc.getElementById('joplin-plugin-content');
	if (!box) return;
	box.style.width = `${Math.round(screen.availWidth / 2)}px`;
	box.style.height = `${Math.round(screen.availHeight / 2)}px`;
}

/**
 * Runs inside the Joplin dialog: draws the voice list and relays what the user
 * does to the plugin. Leaving the dialog (its buttons) is handled by the plugin.
 */
export function initVoiceDialog(
	doc: Document,
	api: DialogApiLike,
	language: string | undefined,
	setTimer: typeof setInterval = setInterval,
) {
	const root = doc.getElementById('tts-voice-root');
	if (!root) throw new Error('Missing #tts-voice-root element');
	const t = getStrings(language);

	const refresh = async (request: DialogRequest = { type: 'state' }) => {
		view.render((await api.postMessage({ type: 'piperPicker', request })) as DialogState);
	};
	const view = createVoicePicker(doc, root, t, { onRequest: (request) => void refresh(request) });
	void refresh();
	// Download progress has no push channel: ask for it while the dialog is open.
	return setTimer(() => void refresh(), DIALOG_POLL_MS);
}

/** Auto-start inside the Joplin dialog webview. */
declare const webviewApi: DialogApiLike | undefined;
if (typeof webviewApi !== 'undefined' && typeof document !== 'undefined') {
	const start = () => {
		sizeDialog(document, screen);
		initVoiceDialog(document, webviewApi, navigator.language);
	};
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();
}
