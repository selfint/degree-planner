import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: true }));
afterEach(() => vi.unstubAllGlobals());

describe('standalone language preference', () => {
	it('reads an existing English preference without loading plan storage', async () => {
		vi.resetModules();
		const getItem = vi.fn(() => 'en');
		vi.stubGlobal('localStorage', { getItem });
		const { content } = await import('./preferences.svelte');
		expect(content.lang.lang).toBe('en');
		expect(getItem.mock.calls).toEqual([['lang']]);
	});

	it.each(['read', 'write'])(
		'falls back safely when browser storage %s is blocked',
		async (operation) => {
			vi.resetModules();
			vi.stubGlobal('localStorage', {
				getItem: () => {
					if (operation === 'read') throw new Error('Blocked');
					return null;
				},
				setItem: () => {
					throw new Error('Blocked');
				}
			});
			const { content } = await import('./preferences.svelte');
			expect(content.lang.lang).toBe('he');
		}
	);
});
