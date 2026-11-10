import { Settings } from '../domain/types';

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
	| { type: 'stop' };

/** Messages sent from the panel webview to the plugin. */
export type PanelToPluginMessage =
	| { type: 'ready' }
	| { type: 'reload'; autoplay?: boolean }
	/** Sentence being read or paused on; null when reading is not in progress. */
	| { type: 'progress'; index: number | null }
	| { type: 'saveSettings'; patch: Partial<Settings> }
	| { type: 'close' };
