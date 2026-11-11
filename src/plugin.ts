import joplin from 'api';
import {
	ContentScriptType,
	MenuItemLocation,
	SettingItemType,
	ToolbarButtonLocation,
} from 'api/types';
import { EDITOR_HIGHLIGHT_COMMAND, EDITOR_SCRIPT_ID, VIEWER_SCRIPT_ID } from './application/ids';
import { Interaction, parseInteraction, planReading, ReadingPlan } from './domain/plan';
import {
	DEFAULT_SETTINGS,
	normalizeSettings,
	SETTING_KEYS,
	SETTINGS_SECTION,
	settingKey,
} from './domain/settings';
import {
	DialogToPluginMessage,
	PanelToPluginMessage,
	PluginToPanelMessage,
} from './application/messages';
import { getStrings } from './webview/i18n';
import { Settings } from './domain/types';
import { composePiper } from './compose/pluginRoot';
import { PiperGate } from './piperGate';
import { VoicePickerFlow } from './piperPicker';

export const COMMAND_READ = 'tts.readNote';
export const COMMAND_STOP = 'tts.stop';
export const COMMAND_PIPER_VOICES = 'tts.piperVoices';
export const PANEL_ID = 'tts.panel';
export const VOICE_DIALOG_ID = 'tts.voiceDialog';

export const PANEL_HTML = '<div id="tts-root"></div>';
export const VOICE_DIALOG_HTML = '<div id="tts-voice-root" style="width:880px;height:480px"></div>';

export async function registerSettings(): Promise<void> {
	await joplin.settings.registerSection(SETTINGS_SECTION, {
		label: 'Joplin Text-to-Speech',
		iconName: 'fas fa-volume-up',
		description:
			'Voice, speed and the speech engine. Voice and speed can also be changed in the player panel. Open source and credits: github.com/rafaeljpc/joplin-tts-plugin (Piper, eSpeak NG, ONNX Runtime).',
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
				'System voices work offline. Piper is offline too, with voices you download. Google Translate is free but unofficial and may stop working. Google Cloud and Azure need your own key.',
			options: {
				webspeech: 'System voices (offline)',
				'google-translate': 'Google Translate (online, free, unofficial)',
				'google-cloud': 'Google Cloud Text-to-Speech (API key)',
				azure: 'Microsoft Azure Speech (API key)',
				piper: 'Piper (offline, downloaded voices)',
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
		[settingKey('piperCatalogUrl')]: {
			section: SETTINGS_SECTION,
			public: true,
			advanced: true,
			type: SettingItemType.String,
			value: DEFAULT_SETTINGS.piperCatalogUrl,
			label: 'Piper voices URL',
			description:
				'Where the offline Piper voices are downloaded from. Only change it if the default stops working.',
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
	// Last cursor / selection reported by the editor or the viewer (latest wins).
	let interaction: Interaction | null = null;

	await joplin.contentScripts.register(
		ContentScriptType.CodeMirrorPlugin,
		EDITOR_SCRIPT_ID,
		'./editorContentScript.js',
	);
	await joplin.contentScripts.register(
		ContentScriptType.MarkdownItPlugin,
		VIEWER_SCRIPT_ID,
		'./viewerContentScript.js',
	);
	// What was loaded in the panel, and the sentence the viewer should highlight.
	let currentPlan: ReadingPlan | null = null;
	let viewerHighlight: string | null = null;

	const track = async (message: unknown) => {
		// The viewer cannot be messaged by the plugin, so it asks for the highlight.
		if ((message as { type?: unknown } | null)?.type === 'poll') {
			return { highlight: viewerHighlight };
		}
		interaction = parseInteraction(message) ?? interaction;
		return undefined;
	};
	await joplin.contentScripts.onMessage(EDITOR_SCRIPT_ID, track);
	await joplin.contentScripts.onMessage(VIEWER_SCRIPT_ID, track);

	const send = (message: PluginToPanelMessage) => joplin.views.panels.postMessage(panel, message);

	// Offline Piper engine: voices live in a local folder; they are downloaded and chosen in a
	// dialog, which when Piper has no voice yet cannot be left without one (or another engine).
	const initial = await readSettings();
	const piper = await composePiper(readSettings);
	const dialog = await joplin.views.dialogs.create(VOICE_DIALOG_ID);
	// About a quarter of the screen. The size is in the HTML itself (not in the CSS file) so that
	// it is there when Joplin measures the content to size the dialog.
	await joplin.views.dialogs.setHtml(dialog, VOICE_DIALOG_HTML);
	await joplin.views.dialogs.addScript(dialog, './webview/voiceDialog.css');
	await joplin.views.dialogs.addScript(dialog, './webview/voiceDialog.js');
	const picker = new VoicePickerFlow(piper.controller, {
		settings: readSettings,
		set: (key, value) => joplin.settings.setValue(settingKey(key), value),
		async showDialog(revertible) {
			const t = getStrings(String(await joplin.settings.globalValue('locale')));
			await joplin.views.dialogs.setButtons(dialog, [
				{ id: 'confirm', title: t.piperUse },
				{ id: 'giveup', title: revertible ? t.piperUseOther : t.close },
			]);
			const result = await joplin.views.dialogs.open(dialog);
			return result.id === 'confirm' ? 'confirm' : 'giveup';
		},
	});
	await joplin.views.panels.onMessage(dialog, (message: DialogToPluginMessage) =>
		picker.request(message.request),
	);
	// The player lists the downloaded voices again after the dialog was used.
	const openVoices = async (revertTo: Parameters<typeof picker.open>[0]) => {
		await picker.open(revertTo);
		if (panelReady) await send({ type: 'voices' });
	};
	const gate = new PiperGate(initial, piper, { open: openVoices });

	const showHighlight = async (index: number | null) => {
		const span = index === null ? null : (currentPlan?.highlights[index] ?? null);
		viewerHighlight = index === null ? null : (currentPlan?.sentences[index] ?? null);
		try {
			await joplin.commands.execute('editor.execCommand', {
				name: EDITOR_HIGHLIGHT_COMMAND,
				args: [span],
			});
		} catch {
			// No Markdown editor on screen (viewer-only layout): nothing to highlight there.
		}
	};

	const loadSelectedNote = async (autoplay: boolean) => {
		const note = await joplin.workspace.selectedNote();
		const settings = await readSettings();
		const plan = note
			? planReading({ title: note.title ?? '', body: note.body ?? '' }, settings, interaction)
			: { sentences: [], startIndex: 0, highlights: [] };
		currentPlan = plan;
		const { sentences, startIndex } = plan;
		await send({ type: 'load', title: note?.title ?? '', sentences, startIndex, autoplay });
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
				await loadSelectedNote(message.autoplay ?? false);
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
			case 'progress':
				await showHighlight(message.index);
				break;
			case 'piperVoices':
				return piper.voices();
			case 'piperSynthesize':
				return piper.synthesize(message.text, message.voiceId);
			case 'close':
				await joplin.views.panels.show(panel, false);
				break;
		}
		return undefined;
	});

	await joplin.commands.register({
		name: COMMAND_READ,
		label: 'Joplin Text-to-Speech: read note',
		iconName: 'fas fa-volume-up',
		execute: async () => {
			if (await gate.blocksReading(await readSettings())) return;
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

	await joplin.commands.register({
		name: COMMAND_PIPER_VOICES,
		label: 'Joplin Text-to-Speech: Piper voices',
		iconName: 'fas fa-download',
		execute: async () => {
			await gate.openVoiceManager(await readSettings());
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
	await joplin.views.menuItems.create(
		COMMAND_PIPER_VOICES,
		COMMAND_PIPER_VOICES,
		MenuItemLocation.Tools,
	);

	await joplin.settings.onChange(async () => {
		const settings = await readSettings();
		await gate.settingsChanged(settings);
		if (panelReady) await send({ type: 'settings', settings });
	});

	// Switching notes while the panel is open: stop and load the new note
	// (without autoplay, so audio never starts unexpectedly).
	await joplin.workspace.onNoteSelectionChange(async () => {
		// A cursor or selection belongs to the previous note.
		interaction = null;
		await showHighlight(null);
		if (!panelReady || !(await joplin.views.panels.visible(panel))) return;
		await loadSelectedNote(false);
	});
}
