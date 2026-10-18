import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { pwaMessages } from '$lib/pwa/messages';

const preferences = vi.hoisted(() => ({ lang: { lang: 'en' as 'en' | 'he' } }));
vi.mock('$lib/preferences.svelte', () => ({ content: preferences }));
import PwaUpdateBanner from './PwaUpdateBanner.svelte';

describe('installed update banner', () => {
	it('renders nothing when no installed update is waiting', () => {
		const { body } = render(PwaUpdateBanner, { props: { visible: false } });
		expect(body).not.toContain('<aside');
		expect(body).not.toContain('pwa-update');
	});

	it.each(['en', 'he'] as const)(
		'provides direct safe update instructions in %s without an activation action',
		(language) => {
			preferences.lang.lang = language;
			const { body } = render(PwaUpdateBanner, {
				props: {
					visible: true,
					updateVersion: 'build-v2',
					persistDismissal: false
				}
			});
			expect(body).toContain('data-testid="pwa-update-banner"');
			expect(body).toContain('role="status"');
			expect(body).toContain(pwaMessages[language].update);
			expect(body).toContain('data-update-version="build-v2"');
			expect(body).toContain('data-testid="pwa-update-dismiss"');
			expect(body).toContain(`aria-label="${pwaMessages[language].close}"`);
			expect(body.match(/<button\b/g)).toHaveLength(1);
			expect(body).not.toMatch(/<(?:a|details)\b/);
		}
	);
	it('keeps the actual version-lookup failure visible without a false dismissal', () => {
		const { body } = render(PwaUpdateBanner, {
			props: {
				visible: true,
				persistDismissal: false,
				updateVersionError:
					'The waiting worker did not answer its version request.'
			}
		});
		expect(body).toContain('role="alert"');
		expect(body).toContain(
			'The waiting worker did not answer its version request.'
		);
		expect(body).toMatch(/<button[^>]*\bdisabled\b/);
	});

	it('keeps the banner before content and removes duplicate footer update/help UI', () => {
		const read = (path: string) =>
			readFileSync(new URL(path, import.meta.url), 'utf8');
		const layout = read('../../routes/app/+layout.svelte');
		const banner = '<PwaUpdateBanner';
		expect(layout).toContain(banner);
		expect(layout).toContain('visible={$offlineShellStatus.updateReady}');
		expect(layout).toContain(
			'updateVersion={$offlineShellStatus.updateVersion}'
		);
		expect(layout.indexOf(banner)).toBeLessThan(layout.indexOf('<main'));
		expect(layout).not.toContain('pwa-install-help');
		expect(read('./PwaStatusView.svelte')).not.toContain('pwa-update-link');
		expect(read('./PwaStatusDetails.svelte')).not.toContain(
			'data-testid="pwa-update"'
		);
	});
});
