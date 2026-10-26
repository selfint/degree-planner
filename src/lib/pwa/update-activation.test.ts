import { describe, expect, it, vi } from 'vitest';
import {
	activateIfSoleClient,
	requestUpdateActivation
} from './update-activation';

describe('explicit worker activation', () => {
	const client = { id: 'a', url: 'https://plan.test/app/plan' };
	function setup(clients = [client]) {
		const deps = {
			origin: 'https://plan.test',
			version: 'v2',
			prepare: vi.fn(async () => {}),
			clients: vi.fn(async () => clients),
			activate: vi.fn(async () => {})
		};
		return deps;
	}
	it('refuses another app tab, including uncontrolled or unknown documents', async () => {
		const deps = setup([
			client,
			{ id: 'b', url: 'https://plan.test/app/offline' }
		]);
		expect(await activateIfSoleClient('v2', client, deps)).toBe('other-tabs');
		expect(deps.activate).not.toHaveBeenCalled();
	});
	it('does not mistake another origin or a landing tab for an app client', async () => {
		const deps = setup([
			client,
			{ id: 'b', url: 'https://plan.test/' },
			{ id: 'c', url: 'https://other.test/app/plan' }
		]);
		expect(await activateIfSoleClient('v2', client, deps)).toBe('accepted');
		expect(deps.prepare).toHaveBeenCalledOnce();
		expect(deps.activate).toHaveBeenCalledOnce();
	});
	it('rechecks clients after preparation and fails closed for an absent source', async () => {
		const deps = setup();
		deps.prepare.mockImplementation(async () => {
			deps.clients.mockResolvedValue([client, { id: 'b', url: client.url }]);
		});
		expect(await activateIfSoleClient('v2', client, deps)).toBe('other-tabs');
		expect(deps.activate).not.toHaveBeenCalled();
		expect(await activateIfSoleClient('v2', undefined, setup())).toBe(
			'invalid'
		);
	});
	it('rejects stale versions and propagates shell failure without activation', async () => {
		const deps = setup();
		expect(await activateIfSoleClient('v1', client, deps)).toBe('invalid');
		deps.prepare.mockRejectedValue(new Error('Missing chunk'));
		await expect(activateIfSoleClient('v2', client, deps)).rejects.toThrow(
			'Missing chunk'
		);
		expect(deps.activate).not.toHaveBeenCalled();
	});
	it('sends version-bound requests and rejects a different version reply', async () => {
		const worker = {
			postMessage(message: unknown, ports: Transferable[]) {
				expect(message).toEqual({ type: 'ACCEPT_UPDATE', version: 'v2' });
				(ports[0] as MessagePort).postMessage({
					type: 'UPDATE_ACTIVATION',
					version: 'v3',
					status: 'accepted'
				});
			}
		};
		await expect(
			requestUpdateActivation(worker as unknown as ServiceWorker, 'v2')
		).rejects.toThrow();
	});
});
