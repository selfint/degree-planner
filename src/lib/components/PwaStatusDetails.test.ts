import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineDetailsOpen, publishOfflineShellStatus } from '$lib/pwa/status';
import { pwaMessages } from '$lib/pwa/messages';
import { shellFailureReasons } from '$lib/pwa/shell-failure';

const preferences = vi.hoisted(() => ({ lang: { lang: 'he' as 'en' | 'he' } }));
vi.mock('$lib/preferences.svelte', () => ({ content: preferences }));
import PwaStatusDetails from './PwaStatusDetails.svelte';

describe('localized offline failure disclosure', () => {
	beforeEach(() => {
		publishOfflineShellStatus({ status: 'ready', updateReady: false });
		offlineDetailsOpen.set(false);
	});
	it.each(shellFailureReasons)(
		'localizes %s in either language at render time',
		(reason) => {
			publishOfflineShellStatus({
				status: 'unavailable',
				updateReady: false,
				error: reason
			});
			for (const language of ['he', 'en'] as const) {
				preferences.lang.lang = language;
				const { body } = render(PwaStatusDetails);
				expect(body).toContain(pwaMessages[language].shellErrors[reason]);
				expect(body).toMatch(/<section\b[^>]*hidden/);
				expect(body).not.toContain('<h2');
			}
		}
	);
	it('shows a translated fallback, never an old worker or browser exception', () => {
		preferences.lang.lang = 'he';
		publishOfflineShellStatus({
			status: 'unavailable',
			updateReady: false,
			error: 'Raw English error with https://internal.invalid/path'
		});
		offlineDetailsOpen.set(true);
		const { body } = render(PwaStatusDetails);
		expect(body).toContain(pwaMessages.he.shellErrors.verification);
		expect(body).not.toContain('Raw English');
		expect(body).not.toContain('internal.invalid');
		expect(body).not.toMatch(/<section\b[^>]*hidden/);
	});
	it('retains the localized failure during retry and removes it only after verified recovery', () => {
		preferences.lang.lang = 'he';
		publishOfflineShellStatus({
			status: 'unavailable',
			updateReady: false,
			error: 'download'
		});
		publishOfflineShellStatus({ status: 'preparing', updateReady: false });
		expect(render(PwaStatusDetails).body).toContain(
			pwaMessages.he.shellErrors.download
		);
		publishOfflineShellStatus({ status: 'ready', updateReady: false });
		expect(render(PwaStatusDetails).body).not.toContain('pwa-status-details');
	});
});
