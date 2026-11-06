import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cms } from '$lib/content';
import { pwaMessages } from '$lib/pwa/messages';
import type { OfflineShellStatus } from '$lib/pwa/status';

const preferences = vi.hoisted(() => ({
	lang: {} as typeof cms.en | typeof cms.he
}));
vi.mock('$lib/preferences.svelte', () => ({ content: preferences }));
import FooterVersion from './FooterVersion.svelte';

const commit = '557d6290ab0c91608d8bbd3819e3ea9256a5a276';
const build = `${commit}-1234567890abcdef`;
const waiting: OfflineShellStatus = {
	status: 'ready',
	updateReady: true,
	updateVersion: 'next-build',
	acceptUpdate: () => {}
};
function markup(
	update?: OfflineShellStatus,
	buildCommit: string | null = commit
) {
	return render(FooterVersion, {
		props: {
			update,
			buildCommit,
			appVersion: buildCommit ? build : 'local-build-123'
		}
	}).body;
}
function action(body: string) {
	return body.match(/<button[^>]*data-testid="footer-update"[^>]*>/)?.[0];
}

beforeEach(() => {
	preferences.lang = cms.en;
});

describe('footer running version and safe update action', () => {
	it('shows the canonical compiled artifact identity, not merely its commit or waiting build', () => {
		const body = markup(waiting);
		expect(body).toContain('Version');
		expect(body).toContain(`title="${build}"`);
		expect(body).toContain('>557d629-12345678</bdi>');
		expect(body).toContain('dir="ltr"');
		expect(body).not.toContain('next-build');
	});
	it('distinguishes different artifacts built from the same source commit', () => {
		const body = render(FooterVersion, {
			props: { buildCommit: commit, appVersion: `${commit}-fedcba0987654321` }
		}).body;
		expect(body).toContain('>557d629-fedcba09</bdi>');
		expect(body).toContain(`data-build-commit="${commit}"`);
	});
	it('uses the compiled Kit identity when the deployment does not provide a commit', () => {
		expect(markup(undefined, null)).toContain('>local-build-123</bdi>');
	});
	it.each(['en', 'he'] as const)(
		'localizes the minimal text action and version in %s',
		(language) => {
			preferences.lang = cms[language];
			const body = markup(waiting);
			expect(body).toContain(cms[language].footer.version);
			expect(body).toContain(`>${pwaMessages[language].updateAccept}</button>`);
			expect(action(body)).toContain('type="button"');
			expect(action(body)).not.toMatch(/\bdisabled\b/);
			expect(body).not.toContain('ui-button');
			expect(body).not.toContain('<a');
		}
	);
	it.each([
		undefined,
		{ ...waiting, updateReady: false },
		{ ...waiting, updateVersion: undefined }
	])(
		'does not offer activation before an installed version is verified',
		(update) => {
			expect(action(markup(update))).toBeUndefined();
		}
	);
	it.each([
		{ updateBlocked: true },
		{ updateBusy: true },
		{ acceptUpdate: undefined },
		{ updateVersionError: 'The waiting version changed.' }
	])('disables the action when unsafe or unavailable: %j', (state) => {
		expect(action(markup({ ...waiting, ...state }))).toMatch(/\bdisabled\b/);
	});
	it.each(['en', 'he'] as const)(
		'explains unsaved or pending writes in %s, including after notice dismissal',
		(language) => {
			preferences.lang = cms[language];
			const body = markup({ ...waiting, updateBlocked: true });
			expect(body).toContain(pwaMessages[language].updateBlocked);
			expect(action(body)).toContain('aria-describedby=');
		}
	);
	it('marks a pending acceptance busy and keeps its running version unchanged', () => {
		const body = markup({ ...waiting, updateBusy: true });
		expect(action(body)).toContain('aria-busy="true"');
		expect(body).toContain('>557d629-12345678</bdi>');
	});
	it('reports a multi-tab refusal without hiding the retry action', () => {
		const body = markup({
			...waiting,
			updateActionError: pwaMessages.en.updateOtherTabs
		});
		expect(body).toContain('role="alert"');
		expect(body).toContain(pwaMessages.en.updateOtherTabs);
		expect(action(body)).not.toMatch(/\bdisabled\b/);
	});
	it('shows verification failures without manufacturing an actionable update', () => {
		const body = markup({
			...waiting,
			updateVersion: undefined,
			updateVersionError: 'No verified update.'
		});
		expect(body).toContain('No verified update.');
		expect(body).toContain('role="alert"');
		expect(action(body)).toBeUndefined();
	});
});
