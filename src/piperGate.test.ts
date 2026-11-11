import { DEFAULT_SETTINGS } from './domain/settings';
import { EngineId, Settings } from './domain/types';
import { PiperGate } from './piperGate';

const settings = (engine: EngineId, voice = ''): Settings => ({
	...DEFAULT_SETTINGS,
	engine,
	voice,
});

function setup(initial: Settings, installed: string[] = []) {
	const voices = {
		hasVoices: jest.fn(async () => installed.length > 0),
		hasVoice: jest.fn(async (id: string) => installed.includes(id)),
	};
	const picker = { open: jest.fn(async () => undefined), dismiss: jest.fn(async () => undefined) };
	return { gate: new PiperGate(initial, voices, picker), picker };
}

describe('PiperGate', () => {
	it('reads normally unless Piper is the engine and has no voice', async () => {
		const other = setup(settings('webspeech'));
		await expect(other.gate.blocksReading(settings('webspeech'))).resolves.toBe(false);
		const withVoice = setup(settings('piper'), ['v']);
		await expect(withVoice.gate.blocksReading(settings('piper'))).resolves.toBe(false);
		const empty = setup(settings('azure'));
		await expect(empty.gate.blocksReading(settings('piper'))).resolves.toBe(true);
		expect(empty.picker.open).toHaveBeenCalledWith('azure');
	});

	it('goes back to webspeech when Piper was already the engine at startup', async () => {
		const { gate, picker } = setup(settings('piper'));
		await gate.blocksReading(settings('piper'));
		expect(picker.open).toHaveBeenCalledWith('webspeech');
	});

	it('the voice manager forces going back only when Piper has no voice', async () => {
		const empty = setup(settings('azure'));
		await empty.gate.openVoiceManager(settings('piper'));
		expect(empty.picker.open).toHaveBeenLastCalledWith('azure');
		await empty.gate.openVoiceManager(settings('azure'));
		expect(empty.picker.open).toHaveBeenLastCalledWith(null);
		const withVoice = setup(settings('piper'), ['v']);
		await withVoice.gate.openVoiceManager(settings('piper'));
		expect(withVoice.picker.open).toHaveBeenLastCalledWith(null);
	});

	it('opens the screen when Piper is chosen without its saved voice, and dismisses it otherwise', async () => {
		const { gate, picker } = setup(settings('google-cloud'), ['v1']);
		await gate.settingsChanged(settings('piper', 'missing'));
		expect(picker.open).toHaveBeenCalledWith('google-cloud');
		await gate.settingsChanged(settings('piper', 'missing')); // already Piper: no new screen
		expect(picker.open).toHaveBeenCalledTimes(1);
		await gate.settingsChanged(settings('azure'));
		expect(picker.dismiss).toHaveBeenCalledTimes(1);
		await gate.settingsChanged(settings('piper', 'v1')); // saved voice exists
		expect(picker.open).toHaveBeenCalledTimes(1);
	});
});
