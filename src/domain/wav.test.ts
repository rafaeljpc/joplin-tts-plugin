import { bytesToBase64, pcmToWav } from './wav';

describe('pcmToWav', () => {
	it('writes a valid mono 16-bit header and scaled, clamped samples', () => {
		const wav = pcmToWav(Float32Array.from([0, 1, -1, 2, -2, 0.5]), 22050);
		const view = new DataView(wav.buffer);
		const tag = (offset: number) => String.fromCharCode(...wav.subarray(offset, offset + 4));
		expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
		expect(wav.length).toBe(44 + 12);
		expect(view.getUint32(4, true)).toBe(36 + 12);
		expect(view.getUint16(22, true)).toBe(1);
		expect(view.getUint32(24, true)).toBe(22050);
		expect(view.getUint32(28, true)).toBe(44100);
		expect(view.getUint32(40, true)).toBe(12);
		const samples = Array.from({ length: 6 }, (_, i) => view.getInt16(44 + i * 2, true));
		expect(samples).toEqual([0, 32767, -32768, 32767, -32768, 16383]);
	});

	it('handles empty audio', () => {
		expect(pcmToWav(new Float32Array(0), 16000).length).toBe(44);
	});
});

describe('bytesToBase64', () => {
	it('encodes small and large buffers', () => {
		expect(bytesToBase64(Uint8Array.from([104, 105]))).toBe('aGk=');
		const big = new Uint8Array(0x8000 * 2 + 5).fill(65);
		expect(atob(bytesToBase64(big))).toBe('A'.repeat(big.length));
	});
});
