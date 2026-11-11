/*
 * Integration test of the Piper engine with the REAL files: it downloads the
 * runtime and the smallest pt-BR voice from the catalog, then synthesizes a
 * sentence and checks the audio. It needs the internet (about 100 MB the first
 * time; files are kept in .cache/piper-integration) and runs the downloaded
 * WebAssembly code, so it is not part of `npm run validate`:
 *
 *   npm run test:integration
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const build = path.join(__dirname, '..', '..', '.cache', 'integration-build', 'src');
const { createPiper } = require(path.join(build, 'piper.js'));
const { DEFAULT_SETTINGS } = require(path.join(build, 'domain', 'settings.js'));
const { voicesForLanguage } = require(path.join(build, 'domain', 'piperCatalog.js'));

const dir = path.join(__dirname, '..', '..', '.cache', 'piper-integration');

/** Reads the header and samples of a 16-bit mono PCM WAV file. */
function readWav(base64) {
	const bytes = Buffer.from(base64, 'base64');
	assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
	assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
	const sampleRate = bytes.readUInt32LE(24);
	const data = bytes.subarray(44);
	const samples = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
	let peak = 0;
	for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
	return { sampleRate, seconds: samples.length / sampleRate, peak };
}

test('downloads a pt-BR voice and speaks with it', { timeout: 15 * 60 * 1000 }, async (t) => {
	const piper = createPiper(async () => DEFAULT_SETTINGS, {
		dir,
		fs: fs.promises,
		fetchFn: (url) => fetch(url),
		requireFn: (id) => require(id),
	});

	const catalog = await piper.storage.fetchCatalog();
	const voices = voicesForLanguage(catalog, 'pt-BR').sort((a, b) => a.sizeBytes - b.sizeBytes);
	assert.ok(voices.length > 0, 'the catalog has pt-BR voices');
	const voice = voices[0];
	t.diagnostic(`voice: ${voice.id} (${(voice.sizeBytes / 1e6).toFixed(1)} MB)`);

	await t.test('downloads the runtime and the voice, and lists it as installed', async () => {
		let last = 0;
		await piper.storage.download(voice, (loaded) => {
			last = loaded;
		});
		assert.ok(last > 0, 'progress was reported');
		assert.ok((await piper.storage.installed()).some((v) => v.id === voice.id));
		assert.equal(await piper.hasVoice(voice.id), true);
	});

	await t.test('speaks a sentence: a real, audible WAV of plausible length', async () => {
		const reply = await piper.synthesize('Olá, tudo bem? Este é um teste de voz.', voice.id);
		assert.equal(reply.ok, true, reply.ok ? '' : reply.error);
		const wav = readWav(reply.wav);
		assert.ok(wav.sampleRate >= 16000, `sample rate ${wav.sampleRate}`);
		assert.ok(wav.seconds > 1.5 && wav.seconds < 15, `duration ${wav.seconds}s`);
		assert.ok(wav.peak > 1000, `the audio is not silent (peak ${wav.peak})`);
	});

	await t.test('a longer text gives longer audio, and a second request works', async () => {
		const short = readWav((await piper.synthesize('Oi.', voice.id)).wav);
		const long = readWav(
			(
				await piper.synthesize(
					'Esta é uma frase bem mais longa, para conferir que a duração do áudio acompanha o texto.',
					voice.id,
				)
			).wav,
		);
		assert.ok(long.seconds > short.seconds * 2, `${long.seconds}s vs ${short.seconds}s`);
	});
});
