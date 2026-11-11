import { PiperVoice } from '../domain/piperCatalog';

/** A voice that is downloaded into the plugin's data folder. */
export interface InstalledVoice {
	id: string;
	name: string;
	/** Locale as written by Piper, for example `pt_BR`. */
	language: string;
	quality: string;
	sizeBytes: number;
}

/** Where Piper voices come from and where they are kept (implemented in adapters). */
export interface PiperStore {
	/** The voices offered by the catalog URL; rejects when it cannot be reached. */
	fetchCatalog(): Promise<PiperVoice[]>;
	installed(): Promise<InstalledVoice[]>;
	download(voice: PiperVoice, onProgress: (loaded: number, total: number) => void): Promise<void>;
	remove(voiceId: string): Promise<void>;
}
