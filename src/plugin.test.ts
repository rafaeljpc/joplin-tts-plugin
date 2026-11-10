import joplin from 'api';
import { SettingItemType } from 'api/types';
import { PanelToPluginMessage } from './lib/types';
import {
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
	j.workspace.selectedNote.mockResolvedValue({
		id: 'n1',
		title: 'My note',
		body: '# Heading\n\nHello **world**. Bye.',
	});
});

const messageHandler = () =>
	j.views.panels.onMessage.mock.calls[0][1] as (m: PanelToPluginMessage) => Promise<void>;
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
		expect(sent().at(-1)).toEqual({ type: 'load', title: '', sentences: [], autoplay: false });
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
