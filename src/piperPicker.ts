import { DialogRequest, DialogState, PiperDialogController } from './application/piperDialog';
import { EngineId, Settings } from './domain/types';

/** What the voice dialog needs from the plugin (the Joplin API lives in the composition root). */
export interface PickerHost {
	settings(): Promise<Settings>;
	set(key: 'voice' | 'engine', value: string): Promise<void>;
	/**
	 * Shows the voice dialog and resolves when the user closes it: `confirm` for the
	 * "use this voice" button, `giveup` for any other way out. `revertible`: giving up
	 * switches to another engine.
	 */
	showDialog(revertible: boolean): Promise<'confirm' | 'giveup'>;
}

/**
 * The Piper voice dialog. When it is opened because Piper has no voice yet, the
 * user can leave it only by confirming a downloaded voice or by going back to
 * another engine (closing the dialog counts as going back).
 */
export class VoicePickerFlow {
	private opened = false;

	constructor(
		private controller: PiperDialogController,
		private host: PickerHost,
	) {}

	get isOpen(): boolean {
		return this.opened;
	}

	/** `revertTo`: the engine to go back to when the user gives up; null just closes the dialog. */
	async open(revertTo: EngineId | null): Promise<void> {
		if (this.opened) return;
		this.opened = true;
		try {
			const settings = await this.host.settings();
			await this.controller.open(settings.language, settings.voice);
			for (;;) {
				const choice = await this.host.showDialog(revertTo !== null);
				if (choice === 'giveup') {
					if (revertTo) await this.host.set('engine', revertTo);
					return;
				}
				const voice = this.controller.selectedVoice;
				if (voice) {
					await this.host.set('voice', voice);
					if ((await this.host.settings()).engine !== 'piper')
						await this.host.set('engine', 'piper');
					return;
				}
				// Confirmed without a voice: show the dialog again, asking for one.
				this.controller.rejectConfirmation();
			}
		} finally {
			this.opened = false;
		}
	}

	/** A request from the dialog (list, download, remove, select). */
	request(request: DialogRequest): Promise<DialogState> {
		return this.controller.handle(request);
	}
}
