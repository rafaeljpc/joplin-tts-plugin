import joplin from 'api';
import {
	ContentScriptType,
	MenuItemLocation,
	SettingItem,
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
import type { composePiper as ComposePiper } from './compose/pluginRoot';
import type { PiperService } from './piper';
import { PiperGate } from './piperGate';
import { VoicePickerFlow } from './piperPicker';

export const COMMAND_READ = 'tts.readNote';
export const COMMAND_STOP = 'tts.stop';
export const COMMAND_PIPER_VOICES = 'tts.piperVoices';
export const PANEL_ID = 'tts.panel';
export const VOICE_DIALOG_ID = 'tts.voiceDialog';

/** True on Joplin mobile (no Node, no desktop-only views); desktop when it cannot be told. */
export async function isMobile(): Promise<boolean> {
	try {
		return (await joplin.versionInfo())?.platform === 'mobile';
	} catch {
		return false;
	}
}

/** Runs an optional step: a view the platform lacks must not stop the plugin from loading. */
async function optional(label: string, step: () => Promise<unknown>): Promise<void> {
	try {
		await step();
	} catch (error) {
		console.warn(`Joplin Text-to-Speech: ${label} is not available here.`, error);
	}
}

const PIPER_UNAVAILABLE = 'Piper is not available on this platform.';

export const PANEL_HTML = '<div id="tts-root"></div>';
export const VOICE_DIALOG_HTML = '<div id="tts-voice-root"></div>';

export async function registerSettings(mobile = false): Promise<void> {
	await joplin.settings.registerSection(SETTINGS_SECTION, {
		label: 'Joplin Text-to-Speech',
		iconName: 'fas fa-volume-up',
		description:
			'Voice, speed and the speech engine. Voice and speed can also be changed in the player panel. Open source and credits: github.com/rafaeljpc/joplin-tts-plugin (Piper, eSpeak NG, ONNX Runtime).',
	});

	const settings: Record<string, SettingItem> = {
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
				// Piper needs Node (files, a downloaded runtime), which Joplin mobile does not have.
				...(mobile ? {} : { piper: 'Piper (offline, downloaded voices)' }),
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
	};
	if (!mobile) {
		Object.assign(settings, {
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
	await joplin.settings.registerSettings(settings);
}

export async function readSettings(mobile = false): Promise<Settings> {
	const raw: Record<string, unknown> = {};
	for (const key of SETTING_KEYS) {
		// Not registered on mobile, where reading it would throw.
		if (mobile && key === 'piperCatalogUrl') continue;
		raw[key] = await joplin.settings.value(settingKey(key));
	}
	const settings = normalizeSettings(raw);
	// A synced `piper` choice cannot run on mobile: fall back to the system voices.
	return mobile && settings.engine === 'piper' ? { ...settings, engine: 'webspeech' } : settings;
}

export async function start(): Promise<void> {
	const mobile = await isMobile();
	const read = () => readSettings(mobile);
	await registerSettings(mobile);

	const panel = await joplin.views.panels.create(PANEL_ID);
	await joplin.views.panels.setHtml(panel, PANEL_HTML);
	await joplin.views.panels.addScript(panel, './webview/player.css');
	await joplin.views.panels.addScript(panel, './webview/player.js');
	await joplin.views.panels.show(panel, false);

	let panelReady = false;
	let pendingAutoplay: boolean | null = null;
	// Last cursor / selection reported by the editor or the viewer (latest wins).
	let interaction: Interaction | null = null;

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
	// Cursor tracking and highlighting are enhancements: reading works without them.
	await optional('the editor script', async () => {
		await joplin.contentScripts.register(
			ContentScriptType.CodeMirrorPlugin,
			EDITOR_SCRIPT_ID,
			'./editorContentScript.js',
		);
		await joplin.contentScripts.onMessage(EDITOR_SCRIPT_ID, track);
	});
	await optional('the viewer script', async () => {
		await joplin.contentScripts.register(
			ContentScriptType.MarkdownItPlugin,
			VIEWER_SCRIPT_ID,
			'./viewerContentScript.js',
		);
		await joplin.contentScripts.onMessage(VIEWER_SCRIPT_ID, track);
	});

	const send = (message: PluginToPanelMessage) => joplin.views.panels.postMessage(panel, message);

	// Offline Piper engine (desktop only: it needs Node). Voices live in a local folder; they are
	// downloaded and chosen in a dialog, which when Piper has no voice yet cannot be left without
	// one (or another engine).
	const initial = await read();
	let piper: PiperService | null = null;
	let gate: PiperGate | null = null;
	if (!mobile) {
		await optional('Piper', async () => {
			// Loaded here, not at the top: its Node modules (fs, path) do not exist on mobile.
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const { composePiper } = require('./compose/pluginRoot') as {
				composePiper: typeof ComposePiper;
			};
			const service = await composePiper(read);
			const dialog = await joplin.views.dialogs.create(VOICE_DIALOG_ID);
			// The dialog is sized by voiceDialog.css: Joplin fits it to the box it measures, #joplin-plugin-content.
			await joplin.views.dialogs.setHtml(dialog, VOICE_DIALOG_HTML);
			await joplin.views.dialogs.addScript(dialog, './webview/voiceDialog.css');
			await joplin.views.dialogs.addScript(dialog, './webview/voiceDialog.js');
			const picker = new VoicePickerFlow(service.controller, {
				settings: read,
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
			gate = new PiperGate(initial, service, { open: openVoices });
			piper = service;
		});
	}

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
		const settings = await read();
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
				await send({ type: 'init', settings: await read() });
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
				return piper ? piper.voices() : { voices: [] };
			case 'piperSynthesize':
				return piper
					? piper.synthesize(message.text, message.voiceId)
					: { ok: false, error: PIPER_UNAVAILABLE };
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
			if (gate && (await gate.blocksReading(await read()))) return;
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

	if (piper) {
		await joplin.commands.register({
			name: COMMAND_PIPER_VOICES,
			label: 'Joplin Text-to-Speech: Piper voices',
			iconName: 'fas fa-download',
			execute: async () => {
				if (gate) await gate.openVoiceManager(await read());
			},
		});
	}

	// Top-right note toolbar and the toolbar above the editor, so the button is
	// reachable whichever layout or editor the user has. Each is optional: Joplin mobile
	// has no menus and may lack some toolbars, and the commands still work without them.
	await optional('the note toolbar button', () =>
		joplin.views.toolbarButtons.create(
			`${COMMAND_READ}.noteToolbar`,
			COMMAND_READ,
			ToolbarButtonLocation.NoteToolbar,
		),
	);
	await optional('the editor toolbar button', () =>
		joplin.views.toolbarButtons.create(
			`${COMMAND_READ}.editorToolbar`,
			COMMAND_READ,
			ToolbarButtonLocation.EditorToolbar,
		),
	);
	await optional('the Tools menu', async () => {
		await joplin.views.menuItems.create(COMMAND_READ, COMMAND_READ, MenuItemLocation.Tools, {
			accelerator: 'CmdOrCtrl+Alt+R',
		});
		if (piper) {
			await joplin.views.menuItems.create(
				COMMAND_PIPER_VOICES,
				COMMAND_PIPER_VOICES,
				MenuItemLocation.Tools,
			);
		}
	});

	await joplin.settings.onChange(async () => {
		const settings = await read();
		if (gate) await gate.settingsChanged(settings);
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
