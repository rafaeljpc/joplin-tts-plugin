import { EngineId, Settings } from './domain/types';

/** What the gate needs to know about the downloaded voices. */
export interface GateVoices {
	hasVoices(): Promise<boolean>;
	hasVoice(id: string): Promise<boolean>;
}

/** What the gate needs from the voice screen. */
export interface GatePicker {
	open(revertTo: EngineId | null): Promise<void>;
}

/**
 * The rules that keep Piper from being used without a voice: which engine to go
 * back to, and when the voice screen has to open.
 */
export class PiperGate {
	private lastNonPiper: EngineId;
	private engineWasPiper: boolean;

	constructor(
		initial: Settings,
		private voices: GateVoices,
		private picker: GatePicker,
	) {
		this.lastNonPiper = initial.engine === 'piper' ? 'webspeech' : initial.engine;
		this.engineWasPiper = initial.engine === 'piper';
	}

	/** True when reading must not start because the voice screen was opened instead. */
	async blocksReading(settings: Settings): Promise<boolean> {
		if (settings.engine !== 'piper' || (await this.voices.hasVoices())) return false;
		await this.picker.open(this.lastNonPiper);
		return true;
	}

	/** The "Piper voices" command: going back is forced only when Piper has no voice. */
	async openVoiceManager(settings: Settings): Promise<void> {
		const goBack = settings.engine === 'piper' && !(await this.voices.hasVoices());
		await this.picker.open(goBack ? this.lastNonPiper : null);
	}

	/** Call after every change of the settings. */
	async settingsChanged(settings: Settings): Promise<void> {
		if (settings.engine !== 'piper') {
			this.lastNonPiper = settings.engine;
		} else if (!this.engineWasPiper && !(await this.voices.hasVoice(settings.voice))) {
			// Piper was just chosen: it needs a downloaded voice before the settings can be left.
			await this.picker.open(this.lastNonPiper);
		}
		this.engineWasPiper = settings.engine === 'piper';
	}
}
