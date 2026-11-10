import joplin from 'api';
import { SettingItemType } from 'api/types';
import { PanelToPluginMessage } from './application/messages';
import { PiperStorage } from './adapters/piperStorage';
import {
	COMMAND_PIPER_VOICES,
	COMMAND_READ,
	COMMAND_STOP,
	PANEL_HTML,
	PANEL_ID,
	readSettings,
	registerSettings,
	start,
} from './plugin';

const j = joplin as unknown as {
	settings: Record<string, jest.Mock>;
	views: {
		panels: Record<string, jest.Mock>;
		toolbarButtons: Record<string, jest.Mock>;
		menuItems: Record<string, jest.Mock>;
	};
	commands: Record<string, jest.Mock>;
	contentScripts: Record<string, jest.Mock>;
	workspace: Record<string, jest.Mock>;
	plugins: Record<string, jest.Mock>;
};

const stored: Record<string, unknown> = {};

beforeEach(() => {
	jest.clearAllMocks();
	for (const k of Object.keys(stored)) delete stored[k];
	j.settings.value.mockImplementation(async (key: string) => stored[key]);
	j.views.panels.create.mockResolvedValue('panel-handle');
	j.views.panels.visible.mockResolvedValue(true);
	j.plugins.dataDir.mockResolvedValue('/joplin-test-data');
	j.workspace.selectedNote.mockResolvedValue({
		id: 'n1',
		title: 'My note',
		body: '# Heading\n\nHello **world**. Bye.',
	});
});

const messageHandler = () =>
	j.views.panels.onMessage.mock.calls[0][1] as (m: PanelToPluginMessage) => Promise<unknown>;
const command = (name: string) =>
	j.commands.register.mock.calls.map((c) => c[0]).find((c) => c.name === name);
const sent = () => j.views.panels.postMessage.mock.calls.map((c) => c[1]);

describe('registerSettings / readSettings', () => {
	it('registers a section and every setting', async () => {
		await registerSettings();
		expect(j.settings.registerSection).toHaveBeenCalledWith('ttsPlugin', expect.any(Object));
		const settings = j.settings.registerSettings.mock.calls[0][0];
		expect(Object.keys(settings)).toEqual([
			'tts.engine',
			'tts.voice',
			'tts.rate',
			'tts.googleApiKey',
			'tts.azureApiKey',
			'tts.azureRegion',
			'tts.language',
			'tts.readTitle',
			'tts.piperCatalogUrl',
		]);
		expect(settings['tts.googleApiKey'].secure).toBe(true);
		expect(settings['tts.azureApiKey'].secure).toBe(true);
		expect(settings['tts.rate'].type).toBe(SettingItemType.String);
	});

	it('reads and normalizes stored values', async () => {
		Object.assign(stored, {
			'tts.engine': 'google-cloud',
			'tts.rate': '1.5',
			'tts.readTitle': false,
		});
		await expect(readSettings()).resolves.toMatchObject({
			engine: 'google-cloud',
			rate: 1.5,
			readTitle: false,
		});
	});
});

describe('start', () => {
	it('creates the panel, commands, toolbar button and menu item', async () => {
		await start();
		expect(j.views.panels.create).toHaveBeenCalledWith(PANEL_ID);
		expect(j.views.panels.setHtml).toHaveBeenCalledWith('panel-handle', PANEL_HTML);
		expect(j.views.panels.addScript.mock.calls.map((c) => c[1])).toEqual([
			'./webview/player.css',
			'./webview/player.js',
		]);
		expect(j.views.panels.show).toHaveBeenCalledWith('panel-handle', false);
		expect(command(COMMAND_READ)).toBeDefined();
		expect(command(COMMAND_STOP)).toBeDefined();
		expect(j.views.toolbarButtons.create).toHaveBeenCalledWith(
			'tts.readNote.noteToolbar',
			COMMAND_READ,
			'noteToolbar',
		);
		expect(j.views.toolbarButtons.create).toHaveBeenCalledWith(
			'tts.readNote.editorToolbar',
			COMMAND_READ,
			'editorToolbar',
		);
		expect(j.views.menuItems.create).toHaveBeenCalledWith(COMMAND_READ, COMMAND_READ, 'tools', {
			accelerator: 'CmdOrCtrl+Alt+R',
		});
	});

	it('defers loading until the webview is ready', async () => {
		await start();
		await command(COMMAND_READ).execute();
		expect(j.views.panels.show).toHaveBeenLastCalledWith('panel-handle', true);
		expect(sent()).toEqual([]);

		await messageHandler()({ type: 'ready' });
		const [init, load] = sent();
		expect(init.type).toBe('init');
		expect(load).toEqual({
			type: 'load',
			title: 'My note',
			sentences: ['My note.', 'Heading', 'Hello world.', 'Bye.'],
			startIndex: 0,
			autoplay: true,
		});
	});

	it('loads immediately once the webview is ready, and omits the title if disabled', async () => {
		stored['tts.readTitle'] = false;
		await start();
		await messageHandler()({ type: 'ready' });
		j.views.panels.postMessage.mockClear();
		await command(COMMAND_READ).execute();
		expect(sent()[0]).toMatchObject({
			type: 'load',
			sentences: ['Heading', 'Hello world.', 'Bye.'],
			autoplay: true,
		});
	});

	it('does not replay a pending autoplay on a later ready', async () => {
		await start();
		await messageHandler()({ type: 'ready' });
		j.views.panels.postMessage.mockClear();
		await messageHandler()({ type: 'ready' });
		expect(sent().map((m) => m.type)).toEqual(['init']);
	});

	it('handles a missing note', async () => {
		j.workspace.selectedNote.mockResolvedValue(null);
		await start();
		await messageHandler()({ type: 'ready' });
		await messageHandler()({ type: 'reload' });
		expect(sent().at(-1)).toEqual({
			type: 'load',
			title: '',
			sentences: [],
			startIndex: 0,
			autoplay: false,
		});
	});

	describe('cursor and selection', () => {
		const handler = (id: string) =>
			(
				j.contentScripts.onMessage.mock.calls.find((c) => c[0] === id) as [
					string,
					(m: unknown) => Promise<void>,
				]
			)[1];

		it('registers the editor and viewer content scripts', async () => {
			await start();
			expect(j.contentScripts.register).toHaveBeenCalledWith(
				'codeMirrorPlugin',
				'tts.editor',
				'./editorContentScript.js',
			);
			expect(j.contentScripts.register).toHaveBeenCalledWith(
				'markdownItPlugin',
				'tts.viewer',
				'./viewerContentScript.js',
			);
		});

		it('starts at the editor cursor', async () => {
			await start();
			await handler('tts.editor')({
				source: 'editor',
				cursor: { line: 2, column: 20 },
				selection: '',
			});
			await messageHandler()({ type: 'ready' });
			await messageHandler()({ type: 'reload' });
			expect(sent().at(-1)).toMatchObject({ startIndex: 3 });
		});

		it('autoplays a reload requested by the play button', async () => {
			await start();
			await messageHandler()({ type: 'ready' });
			await messageHandler()({ type: 'reload', autoplay: true });
			expect(sent().at(-1)).toMatchObject({ type: 'load', autoplay: true });
		});

		it('reads only the selection made in the viewer, ignoring invalid messages', async () => {
			await start();
			await handler('tts.viewer')({ source: 'viewer', selection: 'Just this.' });
			await handler('tts.viewer')('garbage');
			await messageHandler()({ type: 'ready' });
			await messageHandler()({ type: 'reload' });
			expect(sent().at(-1)).toMatchObject({ sentences: ['Just this.'], startIndex: 0 });
		});

		it('forgets the cursor when another note is selected', async () => {
			await start();
			await handler('tts.viewer')({ source: 'viewer', selection: 'Just this.' });
			await messageHandler()({ type: 'ready' });
			const changed = j.workspace.onNoteSelectionChange.mock.calls[0][0] as () => Promise<void>;
			await changed();
			expect(sent().at(-1)).toMatchObject({
				sentences: ['My note.', 'Heading', 'Hello world.', 'Bye.'],
			});
		});
	});

	describe('highlight', () => {
		const viewerHandler = () =>
			(
				j.contentScripts.onMessage.mock.calls.find((c) => c[0] === 'tts.viewer') as [
					string,
					(m: unknown) => Promise<unknown>,
				]
			)[1];
		const highlightCall = () => j.commands.execute.mock.calls.at(-1);
		const started = async () => {
			await start();
			await messageHandler()({ type: 'ready' });
			await messageHandler()({ type: 'reload' });
		};

		it('highlights the sentence being read in the editor', async () => {
			await started();
			await messageHandler()({ type: 'progress', index: 2 });
			expect(highlightCall()).toEqual([
				'editor.execCommand',
				{ name: 'tts.highlight', args: [{ line: 2, from: 0, to: 16 }] },
			]);
		});

		it('clears the highlight when reading ends, and for the title', async () => {
			await started();
			await messageHandler()({ type: 'progress', index: null });
			expect(highlightCall()?.[1].args).toEqual([null]);
			await messageHandler()({ type: 'progress', index: 0 });
			expect(highlightCall()?.[1].args).toEqual([null]);
		});

		it('keeps working when there is no editor to highlight in', async () => {
			j.commands.execute.mockRejectedValueOnce(new Error('no editor'));
			await started();
			await expect(messageHandler()({ type: 'progress', index: 2 })).resolves.toBeUndefined();
		});

		it('ignores progress that does not match anything loaded', async () => {
			await start();
			await messageHandler()({ type: 'progress', index: 1 });
			expect(highlightCall()?.[1].args).toEqual([null]);
			await messageHandler()({ type: 'ready' });
			await messageHandler()({ type: 'reload' });
			await messageHandler()({ type: 'progress', index: 99 });
			expect(highlightCall()?.[1].args).toEqual([null]);
			expect(await viewerHandler()({ type: 'poll' })).toEqual({ highlight: null });
			expect(await viewerHandler()(null)).toBeUndefined();
		});

		it('tells the viewer which sentence to highlight when it polls', async () => {
			await started();
			expect(await viewerHandler()({ type: 'poll' })).toEqual({ highlight: null });
			await messageHandler()({ type: 'progress', index: 3 });
			expect(await viewerHandler()({ type: 'poll' })).toEqual({ highlight: 'Bye.' });
			await messageHandler()({ type: 'progress', index: null });
			expect(await viewerHandler()({ type: 'poll' })).toEqual({ highlight: null });
		});

		it('clears the highlight when another note is selected', async () => {
			await started();
			await messageHandler()({ type: 'progress', index: 3 });
			const changed = j.workspace.onNoteSelectionChange.mock.calls[0][0] as () => Promise<void>;
			await changed();
			expect(highlightCall()?.[1].args).toEqual([null]);
			expect(await viewerHandler()({ type: 'poll' })).toEqual({ highlight: null });
		});
	});

	it('handles a note without title or body', async () => {
		j.workspace.selectedNote.mockResolvedValue({ id: 'x' });
		await start();
		await messageHandler()({ type: 'ready' });
		await messageHandler()({ type: 'reload' });
		expect(sent().at(-1)).toMatchObject({ title: '', sentences: [] });
	});

	it('persists saved settings, converting the rate to a string', async () => {
		await start();
		await messageHandler()({ type: 'saveSettings', patch: { rate: 1.25, voice: 'v1' } });
		expect(j.settings.setValue).toHaveBeenCalledWith('tts.voice', 'v1');
		expect(j.settings.setValue).toHaveBeenCalledWith('tts.rate', '1.25');
		expect(j.settings.setValue).toHaveBeenCalledTimes(2);
	});

	it('hides the panel on close and stops on the stop command', async () => {
		await start();
		await messageHandler()({ type: 'close' });
		expect(j.views.panels.show).toHaveBeenLastCalledWith('panel-handle', false);
		await command(COMMAND_STOP).execute();
		expect(sent().at(-1)).toEqual({ type: 'stop' });
	});

	it('pushes settings changes to a ready panel only', async () => {
		await start();
		const onChange = j.settings.onChange.mock.calls[0][0] as () => Promise<void>;
		await onChange();
		expect(sent()).toEqual([]);
		await messageHandler()({ type: 'ready' });
		j.views.panels.postMessage.mockClear();
		await onChange();
		expect(sent()[0].type).toBe('settings');
	});

	it('reloads without autoplay when the selected note changes', async () => {
		await start();
		const onSelection = j.workspace.onNoteSelectionChange.mock.calls[0][0] as () => Promise<void>;
		await onSelection(); // not ready yet
		expect(sent()).toEqual([]);
		await messageHandler()({ type: 'ready' });
		j.views.panels.postMessage.mockClear();
		j.views.panels.visible.mockResolvedValueOnce(false);
		await onSelection(); // hidden panel
		expect(sent()).toEqual([]);
		await onSelection();
		expect(sent()[0]).toMatchObject({ type: 'load', autoplay: false });
	});
});

describe('Piper voices', () => {
	const onChange = () => j.settings.onChange.mock.calls[0][0] as () => Promise<void>;
	const setValueCalls = () => j.settings.setValue.mock.calls;

	it('offers the engine, a command and a Tools menu item', async () => {
		await registerSettings();
		const engine = j.settings.registerSettings.mock.calls[0][0]['tts.engine'];
		expect(engine.options.piper).toMatch('Piper');
		await start();
		expect(command(COMMAND_PIPER_VOICES)).toBeDefined();
		expect(j.views.menuItems.create).toHaveBeenCalledWith(
			COMMAND_PIPER_VOICES,
			COMMAND_PIPER_VOICES,
			'tools',
		);
	});

	it('answers the player about voices and speech while none is downloaded', async () => {
		await start();
		await expect(messageHandler()({ type: 'piperVoices' })).resolves.toEqual({ voices: [] });
		await expect(
			messageHandler()({ type: 'piperSynthesize', text: 'Hi', voiceId: '' }),
		).resolves.toMatchObject({ ok: false, error: expect.stringContaining('No Piper voice') });
	});

	it('choosing Piper without a voice opens the voice screen, and giving up goes back', async () => {
		stored['tts.engine'] = 'azure';
		await start();
		await messageHandler()({ type: 'ready' });
		j.views.panels.postMessage.mockClear();

		stored['tts.engine'] = 'piper';
		await onChange()();
		expect(j.views.panels.show).toHaveBeenLastCalledWith('panel-handle', true);
		expect(sent()).toContainEqual({ type: 'openVoicePicker', revertible: true });

		// The panel asks for the screen state, then the user gives up.
		const state = await messageHandler()({ type: 'piperPicker', request: { type: 'state' } });
		expect(state).toMatchObject({ voices: [], online: false });
		await expect(
			messageHandler()({ type: 'piperPickerDone', confirm: true }),
		).resolves.toMatchObject({
			ok: false,
			state: { notice: 'choose-voice' },
		});
		await expect(messageHandler()({ type: 'piperPickerDone', confirm: false })).resolves.toEqual({
			ok: true,
		});
		expect(setValueCalls()).toContainEqual(['tts.engine', 'azure']);
	});

	it('closing the panel counts as giving up', async () => {
		stored['tts.engine'] = 'azure';
		await start();
		stored['tts.engine'] = 'piper';
		await onChange()();
		await messageHandler()({ type: 'close' });
		expect(setValueCalls()).toContainEqual(['tts.engine', 'azure']);
		expect(j.views.panels.show).toHaveBeenLastCalledWith('panel-handle', false);
	});

	it('goes back to webspeech when Piper was already the engine at startup', async () => {
		stored['tts.engine'] = 'piper';
		await start();
		await command(COMMAND_READ).execute();
		await messageHandler()({ type: 'piperPickerDone', confirm: false });
		expect(setValueCalls()).toContainEqual(['tts.engine', 'webspeech']);
	});

	it('reading with Piper and no voice opens the voice screen instead of reading', async () => {
		stored['tts.engine'] = 'piper';
		await start();
		await messageHandler()({ type: 'ready' });
		j.views.panels.postMessage.mockClear();
		await command(COMMAND_READ).execute();
		expect(sent().map((m) => m.type)).toEqual(['openVoicePicker']);
	});

	it('shows the voice screen again to a panel that was not ready', async () => {
		stored['tts.engine'] = 'piper';
		await start();
		await command(COMMAND_READ).execute();
		j.views.panels.postMessage.mockClear();
		await messageHandler()({ type: 'ready' });
		expect(sent().map((m) => m.type)).toEqual(['init', 'openVoicePicker']);
	});

	it('the Piper voices command opens the screen, without forcing another engine unless Piper has no voice', async () => {
		stored['tts.engine'] = 'azure';
		await start();
		await command(COMMAND_PIPER_VOICES).execute();
		expect(sent()).toContainEqual({ type: 'openVoicePicker', revertible: false });
		await messageHandler()({ type: 'piperPickerDone', confirm: false });

		stored['tts.engine'] = 'piper';
		await onChange()();
		await messageHandler()({ type: 'piperPickerDone', confirm: false });
		await command(COMMAND_PIPER_VOICES).execute();
		expect(sent().at(-1)).toEqual({ type: 'openVoicePicker', revertible: true });
	});

	it('switching to another engine while the screen is open closes it', async () => {
		stored['tts.engine'] = 'azure';
		await start();
		stored['tts.engine'] = 'piper';
		await onChange()();
		stored['tts.engine'] = 'google-cloud';
		await onChange()();
		expect(sent().at(-1)).toEqual({ type: 'closeVoicePicker' });
	});

	it('does not open the screen when the saved voice is downloaded', async () => {
		const installed = jest
			.spyOn(PiperStorage.prototype, 'installed')
			.mockResolvedValue([
				{
					id: 'pt_BR-faber-medium',
					name: 'faber',
					language: 'pt_BR',
					quality: 'medium',
					sizeBytes: 1,
				},
			]);
		stored['tts.engine'] = 'azure';
		stored['tts.voice'] = 'pt_BR-faber-medium';
		await start();
		stored['tts.engine'] = 'piper';
		await onChange()();
		expect(sent().map((m) => m.type)).not.toContain('openVoicePicker');
		installed.mockRestore();
	});
});
