import { Settings, Voice } from '../domain/types';
import { DialogRequest } from './piperDialog';

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
	/** The downloaded Piper voices changed (the voice dialog was used): list them again. */
	| { type: 'voices' };

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
	| { type: 'close' };

/** Messages sent from the Piper voice dialog to the plugin. */
export type DialogToPluginMessage =
	/** A request (list, download, remove, select); answered with a `DialogState`. */
	{ type: 'piperPicker'; request: DialogRequest };

/** The voices downloaded for the Piper engine. */
export interface PiperVoicesReply {
	voices: Voice[];
}

/** One sentence spoken by Piper: base64 of a WAV file, or why it failed. */
export type PiperSynthesizeReply = { ok: true; wav: string } | { ok: false; error: string };
