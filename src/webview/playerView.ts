import { PlayerState } from '../application/player';
import { Voice } from '../domain/types';
import { format, Strings } from './i18n';

/** What the user can do in the panel. The view only reports; it holds no logic. */
export interface ViewHandlers {
	onClose(): void;
	onPlay(): void;
	onPrevious(): void;
	onNext(): void;
	onStop(): void;
	onRate(rate: number): void;
	onVoice(voiceId: string): void;
}

export interface PlayerView {
	showError(message: string | null): void;
	render(state: PlayerState, title: string): void;
	setRates(rates: number[], selected: number): void;
	setVoices(voices: Voice[], selectedId: string): void;
	/** Switches between the desktop layout and the touch (bottom player) layout. */
	setMobile(mobile: boolean, dialog: boolean): void;
}

/** Speeds offered as chips in the touch layout (the others stay in the select). */
export const CHIP_RATES = [1, 1.25, 1.5, 2];

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

/** Builds the panel DOM inside `root` and returns the operations to update it. */
export function createView(
	doc: Document,
	root: HTMLElement,
	t: Strings,
	handlers: ViewHandlers,
): PlayerView {
	const titleEl = el(doc, 'div', { className: 'tts-title' });
	const closeBtn = el(doc, 'button', { className: 'tts-close', title: t.close, textContent: '×' });
	const sentenceEl = el(doc, 'div', { className: 'tts-sentence', textContent: t.ready });
	const errorEl = el(doc, 'div', { className: 'tts-error', hidden: true });
	const prevBtn = el(doc, 'button', { className: 'tts-prev', title: t.previous, textContent: '⏮' });
	const playBtn = el(doc, 'button', { className: 'tts-play', title: t.play, textContent: '▶' });
	const nextBtn = el(doc, 'button', { className: 'tts-next', title: t.next, textContent: '⏭' });
	const stopBtn = el(doc, 'button', { className: 'tts-stop', title: t.stop, textContent: '⏹' });
	const voiceSelect = el(doc, 'select', { className: 'tts-voice', title: t.voice });
	const rateSelect = el(doc, 'select', { className: 'tts-rate', title: t.speed });
	const progress = el(doc, 'progress', { className: 'tts-progress', max: 1, value: 0 });
	const counter = el(doc, 'div', { className: 'tts-counter' });
	const chips = el(doc, 'div', { className: 'tts-chips' });
	let selectedRate = 0;
	const markChips = () => {
		for (const chip of Array.from(chips.children) as HTMLButtonElement[]) {
			const active = Number(chip.dataset.rate) === selectedRate;
			chip.classList.toggle('tts-chip-active', active);
			chip.setAttribute('aria-pressed', String(active));
		}
	};

	root.replaceChildren(
		el(doc, 'div', { className: 'tts-handle' }),
		el(doc, 'div', { className: 'tts-header' }, [titleEl, closeBtn]),
		// Transparent box on desktop; the highlighted card on mobile (see player.css).
		el(doc, 'div', { className: 'tts-card' }, [counter, sentenceEl]),
		errorEl,
		progress,
		el(doc, 'div', { className: 'tts-controls' }, [prevBtn, playBtn, nextBtn, stopBtn]),
		el(doc, 'div', { className: 'tts-options' }, [chips, voiceSelect, rateSelect]),
	);

	closeBtn.onclick = () => handlers.onClose();
	playBtn.onclick = () => handlers.onPlay();
	prevBtn.onclick = () => handlers.onPrevious();
	nextBtn.onclick = () => handlers.onNext();
	stopBtn.onclick = () => handlers.onStop();
	rateSelect.onchange = () => handlers.onRate(Number(rateSelect.value));
	voiceSelect.onchange = () => handlers.onVoice(voiceSelect.value);

	return {
		showError(message) {
			errorEl.hidden = message === null;
			errorEl.textContent = message === null ? '' : t.errorPrefix + message;
		},

		render(state, title) {
			const playing = state.status === 'playing';
			playBtn.textContent = playing ? '⏸' : '▶';
			playBtn.title = playing ? t.pause : t.play;
			titleEl.textContent = title || t.title;
			if (state.total === 0) {
				sentenceEl.textContent = title ? t.empty : t.ready;
				counter.textContent = '';
				progress.value = 0;
			} else {
				sentenceEl.textContent = state.sentence;
				counter.textContent = format(t.sentenceOf, state.index + 1, state.total);
				progress.value = (state.index + 1) / state.total;
			}
			playBtn.disabled = state.total === 0;
			prevBtn.disabled = stopBtn.disabled = nextBtn.disabled = state.total === 0;
		},

		setMobile(mobile, dialog) {
			root.classList.toggle('tts-mobile', mobile);
			root.classList.toggle('tts-dialog', mobile && dialog);
		},

		setRates(rates, selected) {
			selectedRate = selected;
			chips.replaceChildren(
				...CHIP_RATES.map((r) => {
					const chip = el(doc, 'button', {
						className: 'tts-chip',
						textContent: `${r}×`,
						title: t.speed,
					});
					chip.dataset.rate = String(r);
					chip.onclick = () => {
						selectedRate = r;
						rateSelect.value = String(r);
						markChips();
						handlers.onRate(r);
					};
					return chip;
				}),
			);
			markChips();
			rateSelect.replaceChildren(
				...rates.map((r) =>
					el(doc, 'option', { value: String(r), textContent: `${r}×`, selected: r === selected }),
				),
			);
		},

		setVoices(voices, selectedId) {
			const sorted = [...voices].sort(
				(a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name),
			);
			voiceSelect.replaceChildren(
				el(doc, 'option', { value: '', textContent: t.defaultVoice }),
				...sorted.map((v) =>
					el(doc, 'option', {
						value: v.id,
						textContent: `${v.name} (${v.lang})`,
						selected: v.id === selectedId,
					}),
				),
			);
		},
	};
}
