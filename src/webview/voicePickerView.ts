import { DialogRequest, DialogState, DialogVoice } from '../application/piperDialog';
import { formatSize } from '../domain/piperCatalog';
import { format, Strings } from './i18n';

/** What the user can do in the voice dialog. The view only reports; it holds no logic. */
export interface VoicePickerHandlers {
	onRequest(request: DialogRequest): void;
}

export interface VoicePickerView {
	render(state: DialogState): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
	doc: Document,
	tag: K,
	props: Partial<HTMLElementTagNameMap[K]> & { className?: string },
	children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
	const node = doc.createElement(tag);
	Object.assign(node, props);
	node.append(...children);
	return node;
}

/** Download progress, 0 to 100 (0 while the size is unknown). */
const percentOf = ({ loaded, total }: { loaded: number; total: number }): number =>
	total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : 0;

/** `pt_BR` as shown to people: `pt-BR`. */
const locale = (code: string): string => code.replace('_', '-');

/** The content of the dialog to download and pick Piper voices, drawn inside `root`. */
export function createVoicePicker(
	doc: Document,
	root: HTMLElement,
	t: Strings,
	handlers: VoicePickerHandlers,
): VoicePickerView {
	const message = el(doc, 'div', { className: 'tts-picker-message' });
	const languageSelect = el(doc, 'select', {
		className: 'tts-picker-language',
		title: t.piperLanguage,
	});
	const list = el(doc, 'div', { className: 'tts-picker-list' });
	const screen = el(doc, 'div', { className: 'tts-picker' }, [
		el(doc, 'div', { className: 'tts-picker-title', textContent: t.piperTitle }),
		el(doc, 'div', { className: 'tts-picker-intro', textContent: t.piperIntro }),
		languageSelect,
		message,
		list,
	]);
	root.append(screen);

	languageSelect.onchange = () =>
		handlers.onRequest({ type: 'state', language: languageSelect.value });

	const status = (voice: DialogVoice, state: DialogState): string => {
		if (state.downloading?.id === voice.id) {
			return format(t.piperDownloading, percentOf(state.downloading));
		}
		return voice.installed ? t.piperDownloaded : '';
	};

	const row = (voice: DialogVoice, state: DialogState): HTMLElement => {
		const busy = state.downloading !== null;
		const size = formatSize(voice.sizeBytes);
		const radio = el(doc, 'input', {
			type: 'radio',
			name: 'tts-picker-voice',
			value: voice.id,
			checked: voice.id === state.selected,
			disabled: !voice.installed,
			title: t.piperUse,
		});
		radio.onchange = () => handlers.onRequest({ type: 'select', id: voice.id });
		const action = voice.installed
			? el(doc, 'button', {
					className: 'tts-picker-remove',
					textContent: t.piperRemove,
					disabled: busy,
				})
			: el(doc, 'button', {
					className: 'tts-picker-download',
					textContent: t.piperDownload,
					disabled: busy,
				});
		action.onclick = () =>
			handlers.onRequest({ type: voice.installed ? 'remove' : 'download', id: voice.id });
		const label = `${voice.name} (${locale(voice.language)}${voice.quality ? `, ${voice.quality}` : ''})`;
		const downloading = state.downloading?.id === voice.id ? state.downloading : null;
		return el(doc, 'div', { className: 'tts-picker-row' }, [
			el(doc, 'label', { className: 'tts-picker-head' }, [
				radio,
				el(doc, 'span', { className: 'tts-picker-name', textContent: label }),
			]),
			el(doc, 'div', { className: 'tts-picker-detail' }, [
				el(doc, 'span', { className: 'tts-picker-size', textContent: size }),
				el(doc, 'span', { className: 'tts-picker-status', textContent: status(voice, state) }),
				action,
			]),
			...(downloading
				? [
						el(doc, 'progress', {
							className: 'tts-picker-progress',
							max: 100,
							value: percentOf(downloading),
						}),
					]
				: []),
		]);
	};

	const text = (state: DialogState): string => {
		if (!state.online && state.voices.length === 0) return t.piperNoChoices;
		if (state.notice === 'choose-voice') return t.piperChooseFirst;
		if (state.error) return t.errorPrefix + state.error;
		return state.online ? '' : t.piperOffline;
	};

	return {
		render(state) {
			languageSelect.replaceChildren(
				el(doc, 'option', {
					value: '',
					textContent: t.piperAllLanguages,
					selected: state.language === '',
				}),
				...state.languages.map((code) =>
					el(doc, 'option', {
						value: code,
						textContent: locale(code),
						selected: code === state.language,
					}),
				),
			);
			message.textContent = text(state);
			message.hidden = message.textContent === '';
			list.replaceChildren(...state.voices.map((voice) => row(voice, state)));
		},
	};
}
