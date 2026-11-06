import { describe, expect, it } from 'vitest';
import { createUpdateSafety } from './update-safety';

describe('update reload safety', () => {
	it('reads live draft guards, including edits after acceptance started', () => {
		const safety = createUpdateSafety();
		let dirty = false;
		const remove = safety.register(() => dirty);
		expect(safety.blocked()).toBe(false);
		dirty = true;
		expect(safety.blocked()).toBe(true);
		remove();
		expect(safety.blocked()).toBe(false);
	});
	it('blocks pending writes and a rejected save until a successful retry', async () => {
		const safety = createUpdateSafety();
		let reject!: (error: Error) => void;
		const result = safety.write(
			() =>
				new Promise((_, fail) => {
					reject = fail;
				})
		);
		expect(safety.blocked()).toBe(true);
		reject(new Error('Save failed'));
		await expect(result).rejects.toThrow('Save failed');
		expect(safety.blocked()).toBe(true);
		await safety.write(async () => 'saved');
		expect(safety.blocked()).toBe(false);
	});
	it('does not clear failure because a concurrent older write succeeds', async () => {
		const safety = createUpdateSafety();
		let resolve!: () => void;
		const earlier = safety.write(
			() =>
				new Promise<void>((done) => {
					resolve = done;
				})
		);
		await expect(
			safety.write(async () => {
				throw new Error('failed');
			})
		).rejects.toThrow();
		resolve();
		await earlier;
		expect(safety.blocked()).toBe(true);
		await safety.write(async () => undefined);
		expect(safety.blocked()).toBe(false);
	});
});
