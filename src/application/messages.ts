import { Settings, Voice } from '../domain/types';
import { DialogRequest, DialogState } from './piperDialog';

/** Messages sent from the plugin (main process) to the panel webview. */
export type PluginToPanelMessage =
	| { type: 'init'; settings: Settings }
	| { type: 'settings'; settings: Settings }
	| {
			type: 'load';
			title: string;
			sentences: string[];
			/** Sentence where reading starts (the one at the editor cursor). */
			startIndex: number;
			autoplay: boolean;
	  }
	| { type: 'stop' }
	/** Shows the Piper voice screen over the player. `revertible`: it can switch to another engine. */
	| { type: 'openVoicePicker'; revertible: boolean }
	| { type: 'closeVoicePicker' };

/** Messages sent from the panel webview to the plugin. */
export type PanelToPluginMessage =
	| { type: 'ready' }
	| { type: 'reload'; autoplay?: boolean }
	/** Sentence being read or paused on; null when reading is not in progress. */
	| { type: 'progress'; index: number | null }
	| { type: 'saveSettings'; patch: Partial<Settings> }
	/** Offline Piper engine: answered with a `PiperVoicesReply`. */
	| { type: 'piperVoices' }
	/** Offline Piper engine: answered with a `PiperSynthesizeReply`. */
	| { type: 'piperSynthesize'; text: string; voiceId: string }
	/** Voice screen: a request (list, download, remove, select); answered with a `DialogState`. */
	| { type: 'piperPicker'; request: DialogRequest }
	/** Voice screen: the user confirmed the selected voice or chose another engine instead. */
	| { type: 'piperPickerDone'; confirm: boolean }
	| { type: 'close' };

/** The voices downloaded for the Piper engine. */
export interface PiperVoicesReply {
	voices: Voice[];
}

/** Answer to `piperPickerDone`: `ok: false` keeps the voice screen open. */
export type PiperPickerDoneReply = { ok: true } | { ok: false; state: DialogState };

/** One sentence spoken by Piper: base64 of a WAV file, or why it failed. */
export type PiperSynthesizeReply = { ok: true; wav: string } | { ok: false; error: string };
