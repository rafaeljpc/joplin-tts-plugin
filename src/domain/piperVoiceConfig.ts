/** The `.onnx.json` configuration that ships with every Piper voice (the parts that are used). */
export interface PiperVoiceConfig {
	audio: { sample_rate: number };
	espeak: { voice: string };
	inference: { noise_scale: number; length_scale: number; noise_w: number };
	/** Symbol to ids; the ids must come from here, since each voice numbers its phonemes. */
	phoneme_id_map?: Record<string, number[]>;
	speaker_id_map?: Record<string, number>;
}
