/* Jest stand-in for the `api` module Joplin injects at runtime. */
const fn = () => jest.fn();

const joplin = {
	plugins: { register: fn(), dataDir: fn() },
	settings: {
		registerSection: fn(),
		registerSettings: fn(),
		value: fn(),
		globalValue: fn(),
		setValue: fn(),
		onChange: fn(),
	},
	views: {
		panels: {
			create: fn(),
			setHtml: fn(),
			addScript: fn(),
			show: fn(),
			visible: fn(),
			onMessage: fn(),
			postMessage: fn(),
		},
		dialogs: {
			create: fn(),
			setFitToContent: fn(),
			setHtml: fn(),
			addScript: fn(),
			setButtons: fn(),
			open: fn(),
		},
		toolbarButtons: { create: fn() },
		menuItems: { create: fn() },
	},
	commands: { register: fn(), execute: fn() },
	contentScripts: { register: fn(), onMessage: fn() },
	workspace: { selectedNote: fn(), onNoteSelectionChange: fn() },
};

export default joplin;
