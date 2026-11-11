import { PiperVoice, voicesForLanguage } from '../domain/piperCatalog';
import { InstalledVoice, PiperStore } from './piperStore';

export interface DialogVoice {
	id: string;
	name: string;
	language: string;
	quality: string;
	sizeBytes: number;
	installed: boolean;
}

/** Everything the voice dialog shows; every request answers with a fresh copy. */
export interface DialogState {
	voices: DialogVoice[];
	/** Locales to filter by (`pt_BR`), sorted. */
	languages: string[];
	/** Filter in use; empty shows every language. */
	language: string;
	/** False when the catalog could not be fetched: only downloaded voices are listed. */
	online: boolean;
	selected: string;
	downloading: { id: string; loaded: number; total: number } | null;
	error: string | null;
	/** `choose-voice` after confirming without a downloaded voice selected. */
	notice: 'choose-voice' | null;
}

export type DialogRequest =
	| { type: 'state'; language?: string }
	| { type: 'download'; id: string }
	| { type: 'remove'; id: string }
	| { type: 'select'; id: string };

const toDialogVoice = (voice: PiperVoice | InstalledVoice, installed: boolean): DialogVoice => ({
	id: voice.id,
	name: voice.name,
	language: voice.language,
	quality: voice.quality,
	sizeBytes: voice.sizeBytes,
	installed,
});

const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

/**
 * Logic of the "Piper voices" dialog: lists the catalog and the downloaded
 * voices, downloads and removes voices, and tracks the selected one.
 */
export class PiperDialogController {
	private catalog: PiperVoice[] = [];
	private installed: InstalledVoice[] = [];
	private online = false;
	private selected = '';
	private language = '';
	private downloading: DialogState['downloading'] = null;
	private error: string | null = null;
	private notice: DialogState['notice'] = null;
	private running: Promise<void> = Promise.resolve();

	constructor(private store: PiperStore) {}

	/** Loads the lists; `selected` is kept only when that voice is downloaded. */
	async open(language: string, selected: string): Promise<void> {
		this.error = null;
		this.notice = null;
		this.installed = await this.store.installed();
		try {
			this.catalog = await this.store.fetchCatalog();
			this.online = true;
		} catch {
			this.catalog = [];
			this.online = false;
		}
		this.selected = this.isInstalled(selected) ? selected : '';
		this.language = language;
		if (this.visibleVoices().length === 0) this.language = '';
	}

	/** True when something can be chosen: downloaded voices, or a catalog to download from. */
	hasChoices(): boolean {
		return this.online || this.installed.length > 0;
	}

	get selectedVoice(): string {
		return this.selected;
	}

	/** Shows the "choose a voice first" notice, for a confirmation without a voice. */
	rejectConfirmation(): void {
		this.notice = 'choose-voice';
	}

	/** Resolves when the running download (if any) has finished. */
	idle(): Promise<void> {
		return this.running;
	}

	async handle(request: DialogRequest): Promise<DialogState> {
		this.notice = null;
		switch (request.type) {
			case 'download':
				this.startDownload(request.id);
				break;
			case 'remove':
				await this.remove(request.id);
				break;
			case 'select':
				if (this.isInstalled(request.id)) this.selected = request.id;
				else this.error = 'Download the voice before selecting it.';
				break;
			default:
				if (request.language !== undefined) this.language = request.language;
		}
		return this.state();
	}

	state(): DialogState {
		return {
			voices: this.visibleVoices(),
			languages: [...new Set(this.allVoices().map((v) => v.language))].sort(),
			language: this.language,
			online: this.online,
			selected: this.selected,
			downloading: this.downloading,
			error: this.error,
			notice: this.notice,
		};
	}

	private isInstalled(id: string): boolean {
		return this.installed.some((v) => v.id === id);
	}

	/** Catalog voices plus downloaded voices the catalog no longer lists (or cannot be reached). */
	private allVoices(): DialogVoice[] {
		const fromCatalog = this.catalog.map((v) => toDialogVoice(v, this.isInstalled(v.id)));
		const known = new Set(this.catalog.map((v) => v.id));
		const extra = this.installed.filter((v) => !known.has(v.id)).map((v) => toDialogVoice(v, true));
		return [...fromCatalog, ...extra].sort((a, b) => a.id.localeCompare(b.id));
	}

	private visibleVoices(): DialogVoice[] {
		const all = this.allVoices();
		if (!this.language) return all;
		const wanted = new Set(
			voicesForLanguage(
				all.map((v) => ({ ...v, files: [] })),
				this.language,
			).map((v) => v.id),
		);
		return all.filter((v) => wanted.has(v.id));
	}

	private startDownload(id: string): void {
		const voice = this.catalog.find((v) => v.id === id);
		if (!voice) {
			this.error = `Voice ${id} is not in the catalog.`;
			return;
		}
		if (this.downloading) return;
		this.error = null;
		this.downloading = { id, loaded: 0, total: voice.sizeBytes };
		this.running = this.store
			.download(voice, (loaded, total) => {
				this.downloading = { id, loaded, total };
			})
			.then(async () => {
				this.installed = await this.store.installed();
				this.selected ||= id;
			})
			.catch((error: unknown) => {
				this.error = errorMessage(error);
			})
			.finally(() => {
				this.downloading = null;
			});
	}

	private async remove(id: string): Promise<void> {
		if (this.downloading?.id === id) return;
		try {
			await this.store.remove(id);
			this.installed = await this.store.installed();
			if (this.selected === id) this.selected = '';
			this.error = null;
		} catch (error) {
			this.error = errorMessage(error);
		}
	}
}
