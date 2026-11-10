import joplin from 'api';
import { MenuItemLocation, SettingItemType, ToolbarButtonLocation } from 'api/types';
import { markdownToPlainText } from './lib/markdown';
import { noteToSentences } from './lib/sentences';
import {
	DEFAULT_SETTINGS,
	normalizeSettings,
	SETTING_KEYS,
	SETTINGS_SECTION,
	settingKey,
} from './lib/settings';
import { PanelToPluginMessage, PluginToPanelMessage, Settings } from './lib/types';

export const COMMAND_READ = 'tts.readNote';
export const COMMAND_STOP = 'tts.stop';
export const PANEL_ID = 'tts.panel';

export const PANEL_HTML = '<div id="tts-root"></div>';

export async function registerSettings(): Promise<void> {
	await joplin.settings.registerSection(SETTINGS_SECTION, {
		label: 'Joplin Text-to-Speech',
		iconName: 'fas fa-volume-up',
		description:
			'Voice, speed and the speech engine. Voice and speed can also be changed in the player panel.',
	});

	await joplin.settings.registerSettings({
		[settingKey('engine')]: {
			section: SETTINGS_SECTION,
			public: true,
			type: SettingItemType.String,
			isEnum: true,
			value: DEFAULT_SETTINGS.engine,
			label: 'Speech engine',
			description:
				'System voices work offline. Google Translate is free but unofficial and may stop working. Google Cloud and Azure need your own key.',
			options: {
				webspeech: 'System voices (offline)',
				'google-translate': 'Google Translate (online, free, unofficial)',
				'google-cloud': 'Google Cloud Text-to-Speech (API key)',
				azure: 'Microsoft Azure Speech (API key)',
			},
		},
		[settingKey('voice')]: {
			section: SETTINGS_SECTION,
			public: false,
			type: SettingItemType.String,
			value: DEFAULT_SETTINGS.voice,
			label: 'Voice',
		},
		[settingKey('rate')]: {
			section: SETTINGS_SECTION,
			public: false,
			type: SettingItemType.String,
			value: String(DEFAULT_SETTINGS.rate),
			label: 'Speed',
		},
		[settingKey('googleApiKey')]: {
			section: SETTINGS_SECTION,
			public: true,
			secure: true,
			type: SettingItemType.String,
			value: DEFAULT_SETTINGS.googleApiKey,
			label: 'Google Cloud API key',
			description: 'Only used with the Google Cloud engine. Stored in the system keychain.',
		},
		[settingKey('azureApiKey')]: {
			section: SETTINGS_SECTION,
			public: true,
			secure: true,
			type: SettingItemType.String,
			value: DEFAULT_SETTINGS.azureApiKey,
			label: 'Azure Speech key',
			description: 'Only used with the Azure engine. Stored in the system keychain.',
		},
		[settingKey('azureRegion')]: {
			section: SETTINGS_SECTION,
			public: true,
			type: SettingItemType.String,
			value: DEFAULT_SETTINGS.azureRegion,
			label: 'Azure Speech region',
			description: 'Region of your Speech resource, for example eastus or brazilsouth.',
		},
		[settingKey('language')]: {
			section: SETTINGS_SECTION,
			public: true,
			type: SettingItemType.String,
			value: DEFAULT_SETTINGS.language,
			label: 'Language code (online engines)',
			description: 'For example en-US or pt-BR. Used to list voices and as the default language.',
		},
		[settingKey('readTitle')]: {
			section: SETTINGS_SECTION,
			public: true,
			type: SettingItemType.Bool,
			value: DEFAULT_SETTINGS.readTitle,
			label: 'Read the note title first',
		},
	});
}

export async function readSettings(): Promise<Settings> {
	const raw: Record<string, unknown> = {};
	for (const key of SETTING_KEYS) raw[key] = await joplin.settings.value(settingKey(key));
	return normalizeSettings(raw);
}

export async function start(): Promise<void> {
	await registerSettings();

	const panel = await joplin.views.panels.create(PANEL_ID);
	await joplin.views.panels.setHtml(panel, PANEL_HTML);
	await joplin.views.panels.addScript(panel, './webview/player.css');
	await joplin.views.panels.addScript(panel, './webview/player.js');
	await joplin.views.panels.show(panel, false);

	let panelReady = false;
	let pendingAutoplay: boolean | null = null;

	const send = (message: PluginToPanelMessage) => joplin.views.panels.postMessage(panel, message);

	const loadSelectedNote = async (autoplay: boolean) => {
		const note = await joplin.workspace.selectedNote();
		const settings = await readSettings();
		const body = note ? markdownToPlainText(note.body ?? '') : '';
		const sentences = note
			? noteToSentences(note.title ?? '', body, settings.readTitle, settings.language)
			: [];
		await send({ type: 'load', title: note?.title ?? '', sentences, autoplay });
	};

	await joplin.views.panels.onMessage(panel, async (message: PanelToPluginMessage) => {
		switch (message.type) {
			case 'ready':
				panelReady = true;
				await send({ type: 'init', settings: await readSettings() });
				if (pendingAutoplay !== null) {
					const autoplay = pendingAutoplay;
					pendingAutoplay = null;
					await loadSelectedNote(autoplay);
				}
				break;
			case 'reload':
				await loadSelectedNote(false);
				break;
			case 'saveSettings':
				for (const key of SETTING_KEYS) {
					if (key in message.patch) {
						const value = message.patch[key];
						// Joplin has no float setting type, so the rate is stored as a string.
						await joplin.settings.setValue(settingKey(key), key === 'rate' ? String(value) : value);
					}
				}
				break;
			case 'close':
				await joplin.views.panels.show(panel, false);
				break;
		}
	});

	await joplin.commands.register({
		name: COMMAND_READ,
		label: 'Joplin Text-to-Speech: read note',
		iconName: 'fas fa-volume-up',
		execute: async () => {
			await joplin.views.panels.show(panel, true);
			if (panelReady) await loadSelectedNote(true);
			else pendingAutoplay = true;
		},
	});

	await joplin.commands.register({
		name: COMMAND_STOP,
		label: 'Joplin Text-to-Speech: stop',
		iconName: 'fas fa-stop',
		execute: async () => {
			await send({ type: 'stop' });
			await joplin.views.panels.show(panel, false);
		},
	});

	// Top-right note toolbar and the toolbar above the editor, so the button is
	// reachable whichever layout or editor the user has.
	await joplin.views.toolbarButtons.create(
		`${COMMAND_READ}.noteToolbar`,
		COMMAND_READ,
		ToolbarButtonLocation.NoteToolbar,
	);
	await joplin.views.toolbarButtons.create(
		`${COMMAND_READ}.editorToolbar`,
		COMMAND_READ,
		ToolbarButtonLocation.EditorToolbar,
	);
	await joplin.views.menuItems.create(COMMAND_READ, COMMAND_READ, MenuItemLocation.Tools, {
		accelerator: 'CmdOrCtrl+Alt+R',
	});

	await joplin.settings.onChange(async () => {
		if (panelReady) await send({ type: 'settings', settings: await readSettings() });
	});

	// Switching notes while the panel is open: stop and load the new note
	// (without autoplay, so audio never starts unexpectedly).
	await joplin.workspace.onNoteSelectionChange(async () => {
		if (!panelReady || !(await joplin.views.panels.visible(panel))) return;
		await loadSelectedNote(false);
	});
}
