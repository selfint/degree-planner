import { describe, expect, it, vi } from 'vitest';
import { servePinnedShell } from './pinned-shell';

describe('installed app navigation ownership', () => {
	it.each(['online', 'offline'])(
		'serves the installed document %s without consulting a newer deployment',
		async () => {
			const installed = new Response('installed-v1');
			const repair = vi.fn();
			expect(await servePinnedShell(async () => installed, repair)).toBe(
				installed
			);
			expect(repair).not.toHaveBeenCalled();
		}
	);
	it('serves a repaired document only after same-build verification and storage', async () => {
		const installed = new Response('verified-v1');
		const read = vi
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(installed);
		const repair = vi.fn().mockResolvedValue(undefined);
		expect(await servePinnedShell(read, repair)).toBe(installed);
		expect(repair).toHaveBeenCalledOnce();
		expect(read).toHaveBeenCalledTimes(2);
	});
	it('never exposes newer network HTML when same-build repair rejects it', async () => {
		const result = await servePinnedShell(
			async () => undefined,
			async () => {
				throw new Error('build-changed: network-v2');
			}
		);
		expect(result.status).toBe(503);
		expect(result.headers.get('cache-control')).toBe('no-store');
		expect(await result.text()).not.toContain('network-v2');
	});
	it('reports missing storage after repair without claiming an installed app is ready', async () => {
		const result = await servePinnedShell(
			async () => undefined,
			async () => {}
		);
		expect(result.status).toBe(503);
	});
	it('returns a readable failure when browser cache access itself fails', async () => {
		const result = await servePinnedShell(
			async () => {
				throw new Error('storage');
			},
			async () => {}
		);
		expect(result.status).toBe(503);
		expect(await result.text()).toContain(
			'Your saved plans have not been removed'
		);
	});
});
