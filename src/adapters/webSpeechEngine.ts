import { SpeakOptions, TtsEngine, Voice } from '../domain/types';

const VOICES_TIMEOUT_MS = 1500;
/** Time `speak()` has to fire `onstart`; Android WebViews may accept it and never speak. */
const START_TIMEOUT_MS = 5000;

export interface WebSpeechMessages {
	/** Shown when the synthesizer accepted the text but never started speaking. */
	noStart: string;
}

/** Engine backed by the browser/Electron `speechSynthesis` (system voices). */
export class WebSpeechEngine implements TtsEngine {
	constructor(
		private synth: SpeechSynthesis,
		private Utterance: typeof SpeechSynthesisUtterance,
		private messages: WebSpeechMessages = {
			noStart: 'Speech synthesis did not start (no voice engine responded).',
		},
	) {}

	// Chromium may garbage-collect an utterance still being spoken and drop its events.
	private current: SpeechSynthesisUtterance | null = null;

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
			const timer = setTimeout(() => {
				this.synth.cancel();
				this.current = null;
				reject(new Error(this.messages.noStart));
			}, START_TIMEOUT_MS);
			utterance.onstart = () => clearTimeout(timer);
			utterance.onend = () => {
				clearTimeout(timer);
				resolve();
			};
			utterance.onerror = (event) => {
				clearTimeout(timer);
				// Cancelling is a normal control flow, not a failure.
				if (event.error === 'canceled' || event.error === 'interrupted') resolve();
				else reject(new Error(`Speech synthesis failed: ${event.error}`));
			};
			this.current = utterance;
			// A synthesizer left paused (seen on Android) swallows every utterance.
			if (this.synth.paused) this.synth.resume();
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
