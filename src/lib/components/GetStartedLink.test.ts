import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
	to: null as { url: URL } | null
}));
vi.mock('$app/state', () => ({ navigating: navigation }));
vi.mock('$lib/preferences.svelte', () => ({
	content: { lang: { common: { getStarted: 'Get Started' } } }
}));

import GetStartedLink from './GetStartedLink.svelte';

describe('Get Started link', () => {
	it('renders an explicit white label utility on the Start link', () => {
		navigation.to = null;
		const { body } = render(GetStartedLink);
		expect(body).toMatch(/class="[^"]*\btext-white\b[^"]*"/);
	});

	it('renders a real destination before JavaScript and Firebase are ready', () => {
		navigation.to = null;
		const { body } = render(GetStartedLink);
		expect(body).toContain('href="/app/"');
		expect(body).toContain('aria-busy="false"');
		expect(body).toContain('Get Started');
		expect(body).not.toContain('<button');
	});

	it('keeps its link and label while navigation is pending', () => {
		navigation.to = { url: new URL('https://example.test/app/settings') };
		const { body } = render(GetStartedLink);
		expect(body).toContain('href="/app/"');
		expect(body).toContain('aria-busy="true"');
		expect(body).toContain('Get Started');
		expect(body).toContain('aria-hidden="true"');
	});

	it('does not show settings progress for a different destination', () => {
		navigation.to = { url: new URL('https://example.test/') };
		expect(render(GetStartedLink).body).toContain('aria-busy="false"');
	});
});
