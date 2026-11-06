import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import NativeVideo from './NativeVideo.svelte';

describe('native feature media', () => {
	it.each(['en', 'he'] as const)(
		'renders deliberate, accessible playback for %s',
		(language) => {
			const { body } = render(NativeVideo, {
				props: {
					source: `/tutorials/feature-search-${language}-light`,
					title: 'Find courses',
					language,
					captions: 'Descriptions',
					unavailable: 'Video unavailable'
				}
			});
			expect(body).toMatch(/<video[^>]+controls/);
			expect(body).toContain('preload="none"');
			expect(body).toMatch(/<video[^>]+playsinline/);
			expect(body).toContain('aria-label="Find courses"');
			expect(body).toContain(
				`src="/tutorials/feature-search-${language}-light.mp4"`
			);
			expect(body).toContain(
				`src="/tutorials/feature-search-${language}-light.webm"`
			);
			expect(body).toContain(`srclang="${language}"`);
			expect(body).toContain('kind="captions"');
			expect(body).toContain('width="960"');
			expect(body).toContain('height="720"');
			expect(body).not.toMatch(/\b(?:autoplay|loop|poster)=/);
			expect(body).not.toMatch(/<h[1-6]|<article|<section/);
		}
	);
});
