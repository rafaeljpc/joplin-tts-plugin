import { PiperDialogController } from './application/piperDialog';
import { PiperStore } from './application/piperStore';
import { DEFAULT_SETTINGS } from './domain/settings';
import { Settings } from './domain/types';
import { PickerHost, VoicePickerFlow } from './piperPicker';

const VOICE = {
	id: 'en_US-amy-low',
	name: 'amy',
	language: 'en_US',
	quality: 'low',
	files: [],
	sizeBytes: 5,
};

function setup(settings: Partial<Settings> = {}, installed = [VOICE]) {
	const store: PiperStore = {
		fetchCatalog: jest.fn().mockResolvedValue([VOICE]),
		installed: jest.fn().mockResolvedValue(installed),
		download: jest.fn(),
		remove: jest.fn(),
	};
	const controller = new PiperDialogController(store);
	const current: Settings = { ...DEFAULT_SETTINGS, ...settings };
	const host: jest.Mocked<PickerHost> = {
		settings: jest.fn(async () => current),
		set: jest.fn(async (key, value) => {
			(current as unknown as Record<string, string>)[key] = value;
		}),
		showPanel: jest.fn().mockResolvedValue(undefined),
		send: jest.fn().mockResolvedValue(undefined),
	};
	return { flow: new VoicePickerFlow(controller, host), host, controller, current };
}

describe('VoicePickerFlow', () => {
	it('opens over the player and tells the panel whether it can go back to another engine', async () => {
		const { flow, host } = setup({ language: 'en-US' });
		await flow.open('webspeech');
		expect(flow.isOpen).toBe(true);
		expect(host.showPanel).toHaveBeenCalled();
		expect(host.send).toHaveBeenCalledWith({ type: 'openVoicePicker', revertible: true });

		const other = setup();
		await other.flow.open(null);
		expect(other.host.send).toHaveBeenCalledWith({ type: 'openVoicePicker', revertible: false });
	});

	it('ignores a second open while it is open, and can resend for a panel that was not ready', async () => {
		const { flow, host } = setup();
		await flow.open('webspeech');
		await flow.open('azure');
		expect(host.showPanel).toHaveBeenCalledTimes(1);
		host.send.mockClear();
		await flow.resend();
		expect(host.send).toHaveBeenCalledTimes(1);

		const closed = setup();
		await closed.flow.resend();
		expect(closed.host.send).not.toHaveBeenCalled();
	});

	it('answers requests through the dialog controller', async () => {
		const { flow } = setup();
		await flow.open('webspeech');
		const state = await flow.request({ type: 'select', id: VOICE.id });
		expect(state.selected).toBe(VOICE.id);
	});

	it('confirming a voice saves it and switches to the Piper engine', async () => {
		const { flow, host, current } = setup();
		await flow.open('webspeech');
		await flow.request({ type: 'select', id: VOICE.id });
		await expect(flow.done(true)).resolves.toEqual({ ok: true });
		expect(host.set).toHaveBeenNthCalledWith(1, 'voice', VOICE.id);
		expect(host.set).toHaveBeenNthCalledWith(2, 'engine', 'piper');
		expect(current).toMatchObject({ voice: VOICE.id, engine: 'piper' });
		expect(flow.isOpen).toBe(false);
	});

	it('does not touch the engine when it is already Piper', async () => {
		const { flow, host } = setup({ engine: 'piper' });
		await flow.open(null);
		await flow.request({ type: 'select', id: VOICE.id });
		await flow.done(true);
		expect(host.set).toHaveBeenCalledTimes(1);
	});

	it('refuses to confirm without a downloaded voice selected and stays open', async () => {
		const { flow, host } = setup({}, []);
		await flow.open('webspeech');
		const reply = await flow.done(true);
		expect(reply).toMatchObject({ ok: false, state: { notice: 'choose-voice' } });
		expect(flow.isOpen).toBe(true);
		expect(host.set).not.toHaveBeenCalled();
	});

	it('giving up goes back to the previous engine', async () => {
		const { flow, host } = setup({ engine: 'piper' });
		await flow.open('azure');
		await expect(flow.done(false)).resolves.toEqual({ ok: true });
		expect(host.set).toHaveBeenCalledWith('engine', 'azure');
		expect(flow.isOpen).toBe(false);
	});

	it('giving up with nowhere to go back to just closes', async () => {
		const { flow, host } = setup();
		await flow.open(null);
		await flow.done(false);
		expect(host.set).not.toHaveBeenCalled();
		expect(flow.isOpen).toBe(false);
	});

	it('closing the panel counts as giving up', async () => {
		const { flow, host } = setup({ engine: 'piper' });
		await flow.open('webspeech');
		await flow.panelClosed();
		expect(host.set).toHaveBeenCalledWith('engine', 'webspeech');
	});

	it('done is a no-op when the screen is not open', async () => {
		const { flow, host } = setup();
		await expect(flow.done(true)).resolves.toEqual({ ok: true });
		expect(host.set).not.toHaveBeenCalled();
	});

	it('dismiss closes the screen in the panel only when it is open', async () => {
		const { flow, host } = setup();
		await flow.dismiss();
		expect(host.send).not.toHaveBeenCalled();
		await flow.open('webspeech');
		host.send.mockClear();
		await flow.dismiss();
		expect(host.send).toHaveBeenCalledWith({ type: 'closeVoicePicker' });
		expect(flow.isOpen).toBe(false);
	});
});
