import { SpeakOptions, TtsEngine, Voice } from './types';

const VOICES_TIMEOUT_MS = 1500;

/** Engine backed by the browser/Electron `speechSynthesis` (system voices). */
export class WebSpeechEngine implements TtsEngine {
	constructor(
		private synth: SpeechSynthesis,
		private Utterance: typeof SpeechSynthesisUtterance,
	) {}

	static isSupported(scope: { speechSynthesis?: SpeechSynthesis }): boolean {
		return typeof scope.speechSynthesis !== 'undefined';
	}

	async listVoices(): Promise<Voice[]> {
		let voices = this.synth.getVoices();
		if (voices.length === 0) voices = await this.waitForVoices();
		return voices.map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
	}

	speak(text: string, options: SpeakOptions): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const utterance = new this.Utterance(text);
			utterance.rate = options.rate;
			const voice = this.synth.getVoices().find((v) => v.voiceURI === options.voiceId);
			if (voice) {
				utterance.voice = voice;
				utterance.lang = voice.lang;
			}
			utterance.onend = () => resolve();
			utterance.onerror = (event) => {
				// Cancelling is a normal control flow, not a failure.
				if (event.error === 'canceled' || event.error === 'interrupted') resolve();
				else reject(new Error(`Speech synthesis failed: ${event.error}`));
			};
			this.synth.speak(utterance);
		});
	}

	cancel(): void {
		this.synth.cancel();
	}

	private waitForVoices(): Promise<SpeechSynthesisVoice[]> {
		return new Promise((resolve) => {
			const done = () => {
				clearTimeout(timer);
				this.synth.removeEventListener('voiceschanged', done);
				resolve(this.synth.getVoices());
			};
			const timer = setTimeout(done, VOICES_TIMEOUT_MS);
			this.synth.addEventListener('voiceschanged', done);
		});
	}
}
