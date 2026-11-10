import { DialogRequest, DialogState, PiperDialogController } from './application/piperDialog';
import { PiperPickerDoneReply, PluginToPanelMessage } from './application/messages';
import { EngineId, Settings } from './domain/types';

/** What the voice screen needs from the plugin (the Joplin API lives in plugin.ts). */
export interface PickerHost {
	settings(): Promise<Settings>;
	set(key: 'voice' | 'engine', value: string): Promise<void>;
	showPanel(): Promise<void>;
	send(message: PluginToPanelMessage): Promise<unknown>;
}

/**
 * The Piper voice screen, shown over the player. While it is open the Piper
 * engine has no voice yet, so the user can leave it only by confirming a
 * downloaded voice or by going back to another engine (closing the panel counts
 * as going back).
 */
export class VoicePickerFlow {
	private opened = false;
	private revertTo: EngineId | null = null;

	constructor(
		private controller: PiperDialogController,
		private host: PickerHost,
	) {}

	get isOpen(): boolean {
		return this.opened;
	}

	/** `revertTo`: the engine to go back to when the user gives up; null just closes the screen. */
	async open(revertTo: EngineId | null): Promise<void> {
		if (this.opened) return;
		const settings = await this.host.settings();
		await this.controller.open(settings.language, settings.voice);
		this.revertTo = revertTo;
		this.opened = true;
		await this.host.showPanel();
		await this.resend();
	}

	/** Shows the screen again, for a panel that was not ready the first time. */
	async resend(): Promise<void> {
		if (this.opened) {
			await this.host.send({ type: 'openVoicePicker', revertible: this.revertTo !== null });
		}
	}

	request(request: DialogRequest): Promise<DialogState> {
		return this.controller.handle(request);
	}

	async done(confirm: boolean): Promise<PiperPickerDoneReply> {
		if (!this.opened) return { ok: true };
		if (confirm) {
			const voice = this.controller.selectedVoice;
			if (!voice) {
				this.controller.rejectConfirmation();
				return { ok: false, state: this.controller.state() };
			}
			await this.host.set('voice', voice);
			if ((await this.host.settings()).engine !== 'piper') await this.host.set('engine', 'piper');
		} else if (this.revertTo) {
			await this.host.set('engine', this.revertTo);
		}
		this.opened = false;
		return { ok: true };
	}

	/** The user closed the panel: that is giving up, like choosing another engine. */
	async panelClosed(): Promise<void> {
		await this.done(false);
	}

	/** The engine was changed elsewhere (settings): the screen is no longer needed. */
	async dismiss(): Promise<void> {
		if (!this.opened) return;
		this.opened = false;
		await this.host.send({ type: 'closeVoicePicker' });
	}
}
