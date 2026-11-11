import { DialogState, DialogVoice } from '../application/piperDialog';
import { getStrings } from './i18n';
import { createVoicePicker, VoicePickerHandlers } from './voicePickerView';

const t = getStrings('en');

const voice = (patch: Partial<DialogVoice> = {}): DialogVoice => ({
	id: 'pt_BR-faber-medium',
	name: 'faber',
	language: 'pt_BR',
	quality: 'medium',
	sizeBytes: 63_201_294,
	installed: false,
	...patch,
});

const state = (patch: Partial<DialogState> = {}): DialogState => ({
	voices: [voice()],
	languages: ['en_US', 'pt_BR'],
	language: 'pt_BR',
	online: true,
	selected: '',
	downloading: null,
	error: null,
	notice: null,
	...patch,
});

function setup() {
	document.body.innerHTML = '<div id="root"></div>';
	const root = document.getElementById('root') as HTMLElement;
	const handlers: jest.Mocked<VoicePickerHandlers> = { onRequest: jest.fn() };
	const view = createVoicePicker(document, root, t, handlers);
	const q = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
	const all = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
	return { view, handlers, q, all };
}

describe('voice picker view', () => {
	it('lists voices with language, quality, size and an action', () => {
		const { view, q, all } = setup();
		view.render(state());
		expect(q('.tts-picker-name').textContent).toBe('faber (pt-BR, medium)');
		expect(q('.tts-picker-size').textContent).toBe('60.3 MB');
		expect(q('.tts-picker-status').textContent).toBe('');
		expect(q('.tts-picker-download').textContent).toBe(t.piperDownload);
		expect(all('.tts-picker-remove')).toHaveLength(0);
		expect(q<HTMLInputElement>('input[type=radio]').disabled).toBe(true);
	});

	it('shows downloaded voices with a remove action and a selectable radio', () => {
		const { view, q } = setup();
		view.render(
			state({ voices: [voice({ installed: true, quality: '' })], selected: 'pt_BR-faber-medium' }),
		);
		expect(q('.tts-picker-name').textContent).toBe('faber (pt-BR)');
		expect(q('.tts-picker-status').textContent).toBe(t.piperDownloaded);
		expect(q('.tts-picker-remove').textContent).toBe(t.piperRemove);
		const radio = q<HTMLInputElement>('input[type=radio]');
		expect(radio.disabled).toBe(false);
		expect(radio.checked).toBe(true);
	});

	it('shows the download progress and blocks other downloads meanwhile', () => {
		const { view, q } = setup();
		view.render(state({ downloading: { id: 'pt_BR-faber-medium', loaded: 25, total: 100 } }));
		expect(q('.tts-picker-status').textContent).toBe('Downloading… 25%');
		expect(q<HTMLProgressElement>('.tts-picker-progress').value).toBe(25);
		expect(q<HTMLButtonElement>('.tts-picker-download').disabled).toBe(true);
		view.render(state({ downloading: { id: 'other', loaded: 1, total: 0 } }));
		expect(document.querySelector('.tts-picker-progress')).toBeNull();
		expect(q('.tts-picker-status').textContent).toBe('');
		view.render(state({ downloading: { id: 'pt_BR-faber-medium', loaded: 1, total: 0 } }));
		expect(q('.tts-picker-status').textContent).toBe('Downloading… 0%');
		view.render(state({ downloading: { id: 'pt_BR-faber-medium', loaded: 500, total: 100 } }));
		expect(q('.tts-picker-status').textContent).toBe('Downloading… 100%');
	});

	it('reports what the user does', () => {
		const { view, handlers, q } = setup();
		view.render(state());
		q('.tts-picker-download').click();
		expect(handlers.onRequest).toHaveBeenLastCalledWith({
			type: 'download',
			id: 'pt_BR-faber-medium',
		});

		view.render(state({ voices: [voice({ installed: true })] }));
		q('.tts-picker-remove').click();
		expect(handlers.onRequest).toHaveBeenLastCalledWith({
			type: 'remove',
			id: 'pt_BR-faber-medium',
		});

		const radio = q<HTMLInputElement>('input[type=radio]');
		radio.dispatchEvent(new Event('change'));
		expect(handlers.onRequest).toHaveBeenLastCalledWith({
			type: 'select',
			id: 'pt_BR-faber-medium',
		});

		const select = q<HTMLSelectElement>('.tts-picker-language');
		select.value = 'en_US';
		select.dispatchEvent(new Event('change'));
		expect(handlers.onRequest).toHaveBeenLastCalledWith({ type: 'state', language: 'en_US' });
	});

	it('offers every language and marks the one in use', () => {
		const { view, q, all } = setup();
		view.render(state());
		expect(all('.tts-picker-language option').map((o) => o.textContent)).toEqual([
			t.piperAllLanguages,
			'en-US',
			'pt-BR',
		]);
		expect(q<HTMLSelectElement>('.tts-picker-language').value).toBe('pt_BR');
		view.render(state({ language: '' }));
		expect(q<HTMLSelectElement>('.tts-picker-language').value).toBe('');
	});

	it('explains notices, errors and the lack of internet', () => {
		const { view, q } = setup();
		const message = q('.tts-picker-message');
		view.render(state());
		expect(message.hidden).toBe(true);
		view.render(state({ notice: 'choose-voice', error: 'ignored' }));
		expect(message.textContent).toBe(t.piperChooseFirst);
		view.render(state({ error: 'disk full' }));
		expect(message.textContent).toBe(`${t.errorPrefix}disk full`);
		view.render(state({ online: false, voices: [voice({ installed: true })] }));
		expect(message.textContent).toBe(t.piperOffline);
	});

	it('without internet or voices, it explains that Piper cannot be used now', () => {
		const { view, q } = setup();
		view.render(state({ online: false, voices: [], notice: 'choose-voice' }));
		expect(q('.tts-picker-message').textContent).toBe(t.piperNoChoices);
	});
});
