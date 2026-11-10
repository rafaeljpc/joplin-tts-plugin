import { PlayerController } from './player';
import { SpeakOptions, TtsEngine, Voice } from '../domain/types';

class FakeEngine implements TtsEngine {
	spoken: { text: string; options: SpeakOptions }[] = [];
	pending: { resolve: () => void; reject: (e: unknown) => void }[] = [];
	cancels = 0;
	prefetched: { text: string; options: SpeakOptions }[] = [];
	voices: Voice[] = [{ id: 'a', name: 'A', lang: 'en' }];

	async listVoices() {
		return this.voices;
	}
	speak(text: string, options: SpeakOptions) {
		this.spoken.push({ text, options });
		return new Promise<void>((resolve, reject) => this.pending.push({ resolve, reject }));
	}
	cancel() {
		this.cancels++;
	}
	prefetch(text: string, options: SpeakOptions) {
		this.prefetched.push({ text, options });
	}
	finish(i = this.pending.length - 1) {
		this.pending[i].resolve();
	}
	fail(error: unknown, i = this.pending.length - 1) {
		this.pending[i].reject(error);
	}
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const setup = (sentences = ['one', 'two', 'three']) => {
	const engine = new FakeEngine();
	const player = new PlayerController(engine);
	player.load(sentences);
	return { engine, player };
};

describe('PlayerController', () => {
	it('starts idle with the loaded sentences', () => {
		const { player } = setup();
		expect(player.getState()).toEqual({ status: 'idle', index: 0, total: 3, sentence: 'one' });
	});

	it('starts at the requested sentence, clamped to the loaded range', () => {
		const { player, engine } = setup();
		player.load(['a', 'b', 'c'], 2);
		player.play();
		expect(engine.spoken.map((s) => s.text)).toEqual(['c']);
		player.load(['a', 'b', 'c'], 99);
		expect(player.getState().index).toBe(2);
		player.load(['a', 'b', 'c'], -4);
		expect(player.getState().index).toBe(0);
		player.load([], 3);
		expect(player.getState().index).toBe(0);
	});

	it('asks the engine to prefetch the sentence that follows the one being spoken', async () => {
		const { player, engine } = setup();
		player.setRate(1.5);
		player.play();
		expect(engine.prefetched.map((p) => p.text)).toEqual(['two']);
		expect(engine.prefetched[0].options.rate).toBe(1.5);
		engine.finish();
		await flush();
		expect(engine.prefetched.map((p) => p.text)).toEqual(['two', 'three']);
		engine.finish();
		await flush();
		// The last sentence has nothing after it.
		expect(engine.prefetched).toHaveLength(2);
	});

	it('works with engines that cannot prefetch', () => {
		const { player, engine } = setup();
		(engine as { prefetch?: unknown }).prefetch = undefined;
		player.play();
		expect(engine.spoken).toHaveLength(1);
	});

	it('does nothing when there is nothing to play', () => {
		const { player, engine } = setup([]);
		player.play();
		player.seek(1);
		expect(engine.spoken).toHaveLength(0);
		expect(player.getState().status).toBe('idle');
		expect(player.getState().sentence).toBe('');
	});

	it('plays sentences one after another and finishes idle', async () => {
		const { player, engine } = setup();
		const states: string[] = [];
		player.onChange((s) => states.push(`${s.status}:${s.index}`));
		player.play();
		expect(engine.spoken.map((s) => s.text)).toEqual(['one']);
		engine.finish();
		await flush();
		engine.finish();
		await flush();
		expect(engine.spoken.map((s) => s.text)).toEqual(['one', 'two', 'three']);
		engine.finish();
		await flush();
		expect(player.getState()).toMatchObject({ status: 'idle', index: 0 });
		expect(states).toContain('playing:2');
	});

	it('ignores play while already playing', () => {
		const { player, engine } = setup();
		player.play();
		player.play();
		expect(engine.spoken).toHaveLength(1);
	});

	it('pauses and resumes the same sentence', async () => {
		const { player, engine } = setup();
		player.play();
		engine.finish();
		await flush();
		player.pause();
		expect(player.getState()).toMatchObject({ status: 'paused', index: 1 });
		player.pause(); // no-op when not playing
		player.toggle();
		expect(engine.spoken.map((s) => s.text)).toEqual(['one', 'two', 'two']);
		player.toggle();
		expect(player.getState().status).toBe('paused');
	});

	it('ignores a stale completion after pause', async () => {
		const { player, engine } = setup();
		player.play();
		player.pause();
		engine.finish(0);
		await flush();
		expect(engine.spoken).toHaveLength(1);
		expect(player.getState()).toMatchObject({ status: 'paused', index: 0 });
	});

	it('stop resets to the first sentence', async () => {
		const { player, engine } = setup();
		player.play();
		engine.finish();
		await flush();
		player.stop();
		expect(player.getState()).toMatchObject({ status: 'idle', index: 0 });
	});

	it('seeks, clamps, and keeps playing', () => {
		const { player, engine } = setup();
		player.next();
		expect(player.getState().index).toBe(1);
		expect(engine.spoken).toHaveLength(0); // idle: no speech
		player.play();
		player.next();
		player.next();
		player.next();
		expect(player.getState().index).toBe(2);
		expect(engine.spoken.at(-1)?.text).toBe('three');
		player.previous();
		player.previous();
		player.previous();
		expect(player.getState().index).toBe(0);
	});

	it('applies rate and voice, restarting only while playing', () => {
		const { player, engine } = setup();
		player.setRate(1.5);
		player.setVoice('v');
		expect(engine.spoken).toHaveLength(0);
		player.play();
		player.setRate(2);
		player.setVoice('w');
		expect(engine.spoken.map((s) => s.options)).toEqual([
			{ voiceId: 'v', rate: 1.5 },
			{ voiceId: 'v', rate: 2 },
			{ voiceId: 'w', rate: 2 },
		]);
	});

	it('reports engine errors, pauses, and wraps non-Error values', async () => {
		const { player, engine } = setup();
		const errors: string[] = [];
		const off = player.onError((e) => errors.push(e.message));
		player.play();
		engine.fail(new Error('boom'));
		await flush();
		expect(player.getState().status).toBe('paused');
		player.play();
		engine.fail('plain');
		await flush();
		off();
		player.play();
		engine.fail(new Error('ignored'));
		await flush();
		expect(errors).toEqual(['boom', 'plain']);
	});

	it('ignores a failure from a superseded sentence', async () => {
		const { player, engine } = setup();
		const errors: string[] = [];
		player.onError((e) => errors.push(e.message));
		player.play();
		player.stop();
		engine.fail(new Error('late'), 0);
		await flush();
		expect(errors).toEqual([]);
	});

	it('unsubscribes change listeners', () => {
		const { player } = setup();
		const listener = jest.fn();
		const off = player.onChange(listener);
		off();
		player.stop();
		expect(listener).not.toHaveBeenCalled();
	});

	it('lists voices from the engine', async () => {
		const { player } = setup();
		await expect(player.listVoices()).resolves.toEqual([{ id: 'a', name: 'A', lang: 'en' }]);
	});

	it('swaps engines and pauses when it was playing', () => {
		const { player, engine } = setup();
		const other = new FakeEngine();
		player.play();
		player.setEngine(other);
		expect(player.getState().status).toBe('paused');
		expect(engine.cancels).toBeGreaterThan(0);
		player.play();
		expect(other.spoken).toHaveLength(1);
		player.stop();
		player.setEngine(engine);
		expect(player.getState().status).toBe('idle');
	});
});
