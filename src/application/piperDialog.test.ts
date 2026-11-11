import { PiperVoice } from '../domain/piperCatalog';
import { PiperDialogController } from './piperDialog';
import { InstalledVoice, PiperStore } from './piperStore';

const voice = (id: string, language: string, sizeBytes = 63_000_000): PiperVoice => ({
	id,
	name: id.split('-')[1],
	language,
	quality: 'low',
	files: [],
	sizeBytes,
});
const CATALOG = [voice('en_US-amy-low', 'en_US'), voice('pt_BR-faber-medium', 'pt_BR')];
const asInstalled = (v: PiperVoice): InstalledVoice => ({
	id: v.id,
	name: v.name,
	language: v.language,
	quality: v.quality,
	sizeBytes: v.sizeBytes,
});

function makeStore(overrides: Partial<PiperStore> = {}, installed: InstalledVoice[] = []) {
	const list = [...installed];
	const store = {
		fetchCatalog: jest.fn().mockResolvedValue(CATALOG),
		installed: jest.fn(async () => [...list]),
		download: jest.fn(async (v: PiperVoice, onProgress: (l: number, t: number) => void) => {
			onProgress(10, v.sizeBytes);
			list.push(asInstalled(v));
		}),
		remove: jest.fn(async (id: string) => {
			list.splice(
				list.findIndex((v) => v.id === id),
				1,
			);
		}),
		...overrides,
	} as jest.Mocked<PiperStore>;
	return store;
}

describe('PiperDialogController', () => {
	it('lists the catalog for the language, with the installed state', async () => {
		const c = new PiperDialogController(makeStore({}, [asInstalled(CATALOG[1])]));
		await c.open('pt-BR', '');
		const state = c.state();
		expect(state.voices).toEqual([
			expect.objectContaining({ id: 'pt_BR-faber-medium', installed: true }),
		]);
		expect(state.languages).toEqual(['en_US', 'pt_BR']);
		expect(state.online).toBe(true);
		expect(c.hasChoices()).toBe(true);
	});

	it('shows every language when none matches, and lets the user filter', async () => {
		const c = new PiperDialogController(makeStore());
		await c.open('xx-YY', '');
		expect(c.state().voices).toHaveLength(2);
		expect(c.state().language).toBe('');
		const state = await c.handle({ type: 'state', language: 'en_US' });
		expect(state.voices.map((v) => v.id)).toEqual(['en_US-amy-low']);
		expect((await c.handle({ type: 'state' })).language).toBe('en_US');
	});

	it('keeps the selected voice only when it is downloaded', async () => {
		const installed = [asInstalled(CATALOG[0])];
		const c1 = new PiperDialogController(makeStore({}, installed));
		await c1.open('en-US', 'en_US-amy-low');
		expect(c1.selectedVoice).toBe('en_US-amy-low');
		const c2 = new PiperDialogController(makeStore({}, installed));
		await c2.open('en-US', 'pt_BR-faber-medium');
		expect(c2.selectedVoice).toBe('');
	});

	it('offline: lists downloaded voices only, and has no choices when there are none', async () => {
		const offline = { fetchCatalog: jest.fn().mockRejectedValue(new Error('offline')) };
		const none = new PiperDialogController(makeStore(offline));
		await none.open('en-US', '');
		expect(none.state()).toMatchObject({ online: false, voices: [] });
		expect(none.hasChoices()).toBe(false);

		const some = new PiperDialogController(makeStore(offline, [asInstalled(CATALOG[0])]));
		await some.open('en-US', '');
		expect(some.state().voices.map((v) => v.id)).toEqual(['en_US-amy-low']);
		expect(some.hasChoices()).toBe(true);
	});

	it('downloads a voice, reports progress and selects it', async () => {
		let release: () => void = () => undefined;
		const store = makeStore({
			download: jest.fn(async (v: PiperVoice, onProgress: (l: number, t: number) => void) => {
				onProgress(5, v.sizeBytes);
				await new Promise<void>((resolve) => (release = resolve));
			}),
		});
		const c = new PiperDialogController(store);
		await c.open('en-US', '');
		const during = await c.handle({ type: 'download', id: 'en_US-amy-low' });
		expect(during.downloading).toEqual({ id: 'en_US-amy-low', loaded: 5, total: 63_000_000 });
		// A second download is ignored while one is running.
		await c.handle({ type: 'download', id: 'pt_BR-faber-medium' });
		expect(store.download).toHaveBeenCalledTimes(1);
		release();
		await c.idle();
		expect(c.state()).toMatchObject({ downloading: null, selected: 'en_US-amy-low', error: null });
	});

	it('keeps an already selected voice after another download', async () => {
		const c = new PiperDialogController(makeStore({}, [asInstalled(CATALOG[0])]));
		await c.open('', 'en_US-amy-low');
		await c.handle({ type: 'download', id: 'pt_BR-faber-medium' });
		await c.idle();
		expect(c.selectedVoice).toBe('en_US-amy-low');
	});

	it('reports download failures (Error and non-Error) and unknown voices', async () => {
		const failing = makeStore({ download: jest.fn().mockRejectedValue(new Error('disk full')) });
		const c = new PiperDialogController(failing);
		await c.open('', '');
		await c.handle({ type: 'download', id: 'en_US-amy-low' });
		await c.idle();
		expect(c.state()).toMatchObject({ error: 'disk full', downloading: null });

		failing.download.mockRejectedValue('boom');
		await c.handle({ type: 'download', id: 'en_US-amy-low' });
		await c.idle();
		expect(c.state().error).toBe('boom');

		expect((await c.handle({ type: 'download', id: 'nope' })).error).toMatch('not in the catalog');
	});

	it('selects only downloaded voices', async () => {
		const c = new PiperDialogController(makeStore({}, [asInstalled(CATALOG[0])]));
		await c.open('', '');
		expect((await c.handle({ type: 'select', id: 'pt_BR-faber-medium' })).error).toMatch(
			'Download',
		);
		const state = await c.handle({ type: 'select', id: 'en_US-amy-low' });
		expect(state.selected).toBe('en_US-amy-low');
	});

	it('removes voices, unselecting a removed one, and reports failures', async () => {
		const store = makeStore({}, [asInstalled(CATALOG[0]), asInstalled(CATALOG[1])]);
		const c = new PiperDialogController(store);
		await c.open('', 'en_US-amy-low');
		let state = await c.handle({ type: 'remove', id: 'pt_BR-faber-medium' });
		expect(state.selected).toBe('en_US-amy-low');
		state = await c.handle({ type: 'remove', id: 'en_US-amy-low' });
		expect(state.selected).toBe('');
		expect(state.voices.every((v) => !v.installed)).toBe(true);

		store.remove.mockRejectedValueOnce(new Error('locked'));
		expect((await c.handle({ type: 'remove', id: 'x' })).error).toBe('locked');
		store.remove.mockRejectedValueOnce('nope');
		expect((await c.handle({ type: 'remove', id: 'x' })).error).toBe('nope');
	});

	it('does not remove the voice being downloaded', async () => {
		let release: () => void = () => undefined;
		const store = makeStore({
			download: jest.fn(() => new Promise<void>((resolve) => (release = resolve))),
		});
		const c = new PiperDialogController(store);
		await c.open('', '');
		await c.handle({ type: 'download', id: 'en_US-amy-low' });
		await c.handle({ type: 'remove', id: 'en_US-amy-low' });
		expect(store.remove).not.toHaveBeenCalled();
		release();
		await c.idle();
	});

	it('shows the choose-voice notice until the next request', async () => {
		const c = new PiperDialogController(makeStore());
		await c.open('', '');
		c.rejectConfirmation();
		expect(c.state().notice).toBe('choose-voice');
		expect((await c.handle({ type: 'state' })).notice).toBeNull();
	});

	it('lists downloaded voices missing from the catalog', async () => {
		const orphan: InstalledVoice = {
			...asInstalled(CATALOG[0]),
			id: 'xx_XX-old-low',
			language: 'xx_XX',
		};
		const c = new PiperDialogController(makeStore({}, [orphan]));
		await c.open('', '');
		expect(c.state().voices.map((v) => v.id)).toContain('xx_XX-old-low');
	});
});
