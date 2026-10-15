import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
	to: null as { url: URL } | null
}));
vi.mock('$app/state', () => ({ navigating: navigation }));
vi.mock('$lib/stores.svelte', () => ({
	content: { lang: { common: { getStarted: 'Get Started' } } }
}));

import GetStartedLink from './GetStartedLink.svelte';

describe('Get Started link', () => {
	it('renders a real destination before JavaScript and Firebase are ready', () => {
		navigation.to = null;
		const { body } = render(GetStartedLink);
		expect(body).toContain('href="/settings"');
		expect(body).toContain('aria-busy="false"');
		expect(body).toContain('Get Started');
		expect(body).not.toContain('<button');
	});

	it('keeps its link and label while navigation is pending', () => {
		navigation.to = { url: new URL('https://example.test/settings') };
		const { body } = render(GetStartedLink);
		expect(body).toContain('href="/settings"');
		expect(body).toContain('aria-busy="true"');
		expect(body).toContain('Get Started');
		expect(body).toContain('aria-hidden="true"');
	});

	it('does not show settings progress for a different destination', () => {
		navigation.to = { url: new URL('https://example.test/plan') };
		expect(render(GetStartedLink).body).toContain('aria-busy="false"');
	});
});
