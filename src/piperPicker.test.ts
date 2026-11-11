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

function setup(settings: Partial<Settings> = {}, choices: ('confirm' | 'giveup')[] = ['giveup']) {
	const store: PiperStore = {
		fetchCatalog: jest.fn().mockResolvedValue([VOICE]),
		installed: jest.fn().mockResolvedValue([VOICE]),
		download: jest.fn(),
		remove: jest.fn(),
	};
	const controller = new PiperDialogController(store);
	const current: Settings = { ...DEFAULT_SETTINGS, ...settings };
	const queue = [...choices];
	const host = {
		settings: jest.fn(async () => current),
		set: jest.fn(async (key, value) => {
			(current as unknown as Record<string, string>)[key] = value;
		}),
		showDialog: jest.fn(async () => queue.shift() ?? 'giveup'),
	};
	return {
		flow: new VoicePickerFlow(controller, host as unknown as PickerHost),
		host,
		controller,
		current,
	};
}

describe('VoicePickerFlow', () => {
	it('tells the dialog whether giving up goes back to another engine', async () => {
		const { flow, host } = setup({ language: 'en-US' });
		await flow.open('webspeech');
		expect(host.showDialog).toHaveBeenCalledWith(true);
		const other = setup();
		await other.flow.open(null);
		expect(other.host.showDialog).toHaveBeenCalledWith(false);
	});

	it('giving up goes back to the previous engine, or just closes without one', async () => {
		const { flow, host } = setup({ engine: 'piper' });
		await flow.open('azure');
		expect(host.set).toHaveBeenCalledWith('engine', 'azure');
		expect(flow.isOpen).toBe(false);
		const none = setup({ engine: 'azure' });
		await none.flow.open(null);
		expect(none.host.set).not.toHaveBeenCalled();
	});

	it('confirming saves the voice and makes Piper the engine', async () => {
		const { flow, host, controller } = setup({ engine: 'azure' }, ['confirm']);
		const open = controller.open.bind(controller);
		jest.spyOn(controller, 'open').mockImplementation(async (language, voice) => {
			await open(language, voice);
			await controller.handle({ type: 'select', id: VOICE.id });
		});
		await flow.open('azure');
		expect(host.set).toHaveBeenCalledWith('voice', VOICE.id);
		expect(host.set).toHaveBeenCalledWith('engine', 'piper');
	});

	it('does not set the engine again when it is already Piper', async () => {
		const { flow, host, controller } = setup({ engine: 'piper', voice: VOICE.id }, ['confirm']);
		void controller;
		await flow.open('webspeech');
		expect(host.set).toHaveBeenCalledWith('voice', VOICE.id);
		expect(host.set).not.toHaveBeenCalledWith('engine', expect.anything());
	});

	it('shows the dialog again, asking for a voice, when it is confirmed without one', async () => {
		const { flow, host, controller } = setup({ voice: '' }, ['confirm', 'giveup']);
		await flow.open('webspeech');
		expect(host.showDialog).toHaveBeenCalledTimes(2);
		expect(controller.state().notice).toBe('choose-voice');
		expect(host.set).toHaveBeenCalledWith('engine', 'webspeech');
	});

	it('ignores a second open while it is open, and relays the dialog requests', async () => {
		const { flow, host } = setup();
		host.showDialog.mockImplementationOnce(async () => {
			expect(flow.isOpen).toBe(true);
			await flow.open('azure');
			const state = await flow.request({ type: 'state' });
			expect(state.voices).toHaveLength(1);
			return 'giveup';
		});
		await flow.open('webspeech');
		expect(host.showDialog).toHaveBeenCalledTimes(1);
	});

	it('is usable again after the dialog fails to open', async () => {
		const { flow, host } = setup();
		host.showDialog.mockRejectedValueOnce(new Error('no dialog'));
		await expect(flow.open(null)).rejects.toThrow('no dialog');
		expect(flow.isOpen).toBe(false);
	});
});
