import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
const preferences = vi.hoisted(() => ({ lang: { lang: 'en' } }));
vi.mock('$lib/preferences.svelte', () => ({ content: preferences }));
import FeatureVideo from './FeatureVideo.svelte';

describe('feature media preferences', () => {
	it.each(['en', 'he'])(
		'uses global %s language without adding duplicate feature copy',
		(language) => {
			preferences.lang.lang = language;
			const { body } = render(FeatureVideo, {
				props: {
					topic: 'feature-search',
					title: 'Search'
				}
			});
			expect(body).toContain(
				`src="/tutorials/feature-search-${language}-dark.mp4"`
			);
			expect(body).toContain('data-testid="feature-search"');
			expect(body).not.toMatch(/<h[1-6]|<article|<section/);
		}
	);
});
