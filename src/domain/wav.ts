/** Encodes mono float PCM (-1..1) as a 16-bit WAV file. */
export const pcmToWav = (pcm: Float32Array, sampleRate: number): Uint8Array => {
	const bytes = new Uint8Array(44 + pcm.length * 2);
	const view = new DataView(bytes.buffer);
	const text = (offset: number, value: string) => {
		for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
	};
	text(0, 'RIFF');
	view.setUint32(4, 36 + pcm.length * 2, true);
	text(8, 'WAVE');
	text(12, 'fmt ');
	view.setUint32(16, 16, true); // PCM header size
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true); // byte rate
	view.setUint16(32, 2, true); // block align
	view.setUint16(34, 16, true); // bits per sample
	text(36, 'data');
	view.setUint32(40, pcm.length * 2, true);
	pcm.forEach((sample, i) => {
		const clamped = Math.max(-1, Math.min(1, sample));
		view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
	});
	return bytes;
};

/** Base64 of the bytes (Node and browsers). */
export const bytesToBase64 = (bytes: Uint8Array): string => {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
};
