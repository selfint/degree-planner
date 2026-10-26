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
		'provides direct safe update instructions in %s with a guarded activation action',
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
			expect(body).toContain('data-testid="pwa-update-accept"');
			expect(body).toContain(pwaMessages[language].updateAccept);
			expect(body).toContain(`aria-label="${pwaMessages[language].close}"`);
			expect(body.match(/<button\b/g)).toHaveLength(2);
			expect(body).not.toMatch(/<(?:a|details)\b/);
		}
	);
	it.each(['en', 'he'] as const)(
		'keeps the %s blocked explanation visible in a full-width row after the controls',
		(language) => {
			preferences.lang.lang = language;
			const { body } = render(PwaUpdateBanner, {
				props: {
					visible: true,
					updateVersion: 'build-v2',
					persistDismissal: false,
					updateBlocked: true,
					onAccept: () => {}
				}
			});
			const reason = body.match(
				/<p[^>]*\sid="([^"]+)"[^>]*>[\s\S]*?<\/p>/
			)?.[0];
			expect(reason).toBeDefined();
			expect(reason).toContain(pwaMessages[language].updateBlocked);
			expect(body.indexOf(reason!)).toBeGreaterThan(
				body.indexOf('data-testid="pwa-update-dismiss"')
			);
			const accept = body.match(
				/<button[^>]*data-testid="pwa-update-accept"[^>]*>/
			)?.[0];
			expect(accept).toMatch(/\bdisabled\b/);
			expect(accept).toContain('aria-describedby=');
			expect(body.match(/<button\b/g)).toHaveLength(2);
		}
	);
	it.each([
		['updateVersionError', 'pwa-update-error'],
		['updateActionError', 'pwa-update-action-error']
	] as const)(
		'gives %s an unclipped full-width alert row',
		(property, testId) => {
			const message =
				'The update could not finish. Save changes in other tabs and close them before retrying.';
			const { body } = render(PwaUpdateBanner, {
				props: {
					visible: true,
					updateVersion: 'build-v2',
					persistDismissal: false,
					[property]: message
				}
			});
			const paragraph = body.match(
				new RegExp(`<p[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?<\\/p>`)
			)?.[0];
			expect(paragraph).toContain('role="alert"');
			expect(paragraph).toContain(message);
			expect(body.indexOf(paragraph!)).toBeGreaterThan(
				body.indexOf('data-testid="pwa-update-dismiss"')
			);
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

	it('keeps the banner before content and shares its safe update state with the footer', () => {
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
		expect(layout).toContain(
			'update={inPwaScope ? $offlineShellStatus : undefined}'
		);
		expect(layout).toContain(
			"const inPwaScope = $derived(page.url.pathname.startsWith('/app/'))"
		);
		expect(layout).toContain('pwa={inPwaScope ? pwaControls : undefined}');
		expect(layout).toMatch(/\{#if inPwaScope\}\s*<PwaUpdateBanner/);
		expect(layout).not.toContain('pwa-install-help');
		expect(read('./PwaStatusView.svelte')).not.toContain('pwa-update-link');
		expect(read('./PwaStatusDetails.svelte')).not.toContain(
			'data-testid="pwa-update"'
		);
	});
});
