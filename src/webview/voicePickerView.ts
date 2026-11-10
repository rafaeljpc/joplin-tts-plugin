import { DialogRequest, DialogState, DialogVoice } from '../application/piperDialog';
import { formatSize } from '../domain/piperCatalog';
import { format, Strings } from './i18n';

/** What the user can do in the voice screen. The view only reports; it holds no logic. */
export interface VoicePickerHandlers {
	onRequest(request: DialogRequest): void;
	/** `confirm`: use the selected voice; otherwise the user chose another engine (or closed). */
	onDone(confirm: boolean): void;
}

export interface VoicePickerView {
	readonly visible: boolean;
	/** `revertible`: the user may give up by switching to another engine. */
	show(revertible: boolean): void;
	hide(): void;
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

/** `pt_BR` as shown to people: `pt-BR`. */
const locale = (code: string): string => code.replace('_', '-');

/** The screen to download and pick Piper voices, drawn over the player inside `root`. */
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
	const confirmBtn = el(doc, 'button', {
		className: 'tts-picker-confirm',
		textContent: t.piperUse,
	});
	const cancelBtn = el(doc, 'button', { className: 'tts-picker-cancel' });
	const screen = el(doc, 'div', { className: 'tts-picker', hidden: true }, [
		el(doc, 'div', { className: 'tts-picker-title', textContent: t.piperTitle }),
		el(doc, 'div', { className: 'tts-picker-intro', textContent: t.piperIntro }),
		languageSelect,
		message,
		list,
		el(doc, 'div', { className: 'tts-picker-buttons' }, [confirmBtn, cancelBtn]),
	]);
	root.append(screen);

	let selected = '';

	confirmBtn.onclick = () => handlers.onDone(true);
	cancelBtn.onclick = () => handlers.onDone(false);
	languageSelect.onchange = () =>
		handlers.onRequest({ type: 'state', language: languageSelect.value });

	const status = (voice: DialogVoice, state: DialogState): string => {
		if (state.downloading?.id === voice.id) {
			const { loaded, total } = state.downloading;
			return format(
				t.piperDownloading,
				total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : 0,
			);
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
		return el(doc, 'div', { className: 'tts-picker-row' }, [
			radio,
			el(doc, 'span', { className: 'tts-picker-name', textContent: label }),
			el(doc, 'span', { className: 'tts-picker-size', textContent: size }),
			el(doc, 'span', { className: 'tts-picker-status', textContent: status(voice, state) }),
			action,
		]);
	};

	const text = (state: DialogState): string => {
		if (state.notice === 'choose-voice') return t.piperChooseFirst;
		if (state.error) return t.errorPrefix + state.error;
		if (!state.online) {
			return state.voices.length === 0 ? t.piperNoChoices : t.piperOffline;
		}
		return '';
	};

	return {
		get visible() {
			return !screen.hidden;
		},

		show(revertible) {
			cancelBtn.textContent = revertible ? t.piperUseOther : t.close;
			screen.hidden = false;
		},

		hide() {
			screen.hidden = true;
		},

		render(state) {
			selected = state.selected;
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
			const nothingToChoose = !state.online && state.voices.length === 0;
			confirmBtn.hidden = nothingToChoose;
			confirmBtn.disabled = selected === '' || state.downloading !== null;
		},
	};
}
