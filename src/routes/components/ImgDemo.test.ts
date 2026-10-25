import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ImgDemo from './ImgDemo.svelte';
import type { Picture } from 'imagetools-core';

const description = createRawSnippet(() => ({
	render: () => '<span>Existing feature description</span>'
}));
const media = createRawSnippet(() => ({
	render: () => '<video data-testid="replacement-media" controls></video>'
}));

describe('feature media slot', () => {
	it('replaces only the media while preserving the original layout, heading and paragraph', () => {
		const { body } = render(ImgDemo, {
			props: { title: 'Search courses', children: description, media }
		});
		expect(body).toContain('sm:flex sm:max-w-[1024px] sm:flex-row');
		expect(body).toContain('sm:min-w-[300px] sm:max-w-[300px]');
		expect(body).toContain('rounded-[15px]');
		expect(body).toContain('min-w-0 flex-1 sm:me-4');
		expect(body.indexOf('<video')).toBeLessThan(body.indexOf('<h2'));
		expect(body).not.toContain('md:order');
		expect(body).toMatch(/<h2[^>]*>Search courses<\/h2>/);
		expect(body).toMatch(
			/<p[^>]*>[\s\S]*Existing feature description[\s\S]*<\/p>/
		);
		expect(body).toContain('data-testid="replacement-media"');
		expect(body).not.toContain('<img');
		expect((body.match(/<section/g) ?? []).length).toBe(1);
	});

	it('keeps feature copy distinct from a media failure paragraph in the original media-first layout', () => {
		const failedMedia = createRawSnippet(() => ({
			render: () =>
				'<div><video controls></video><p role="status">The video could not load.</p></div>'
		}));
		const { body } = render(ImgDemo, {
			props: {
				title: 'Search courses',
				children: description,
				media: failedMedia
			}
		});
		// The old p.first() target is the status, while h2 + p targets copy.
		expect(body.indexOf('<p role="status"')).toBeLessThan(body.indexOf('<h2'));
		expect(body).toMatch(
			/<h2[^>]*>Search courses<\/h2>\s*<p[^>]*>[\s\S]*Existing feature description[\s\S]*<\/p>/
		);
		expect(body).toContain('<p role="status">The video could not load.</p>');
	});
	it('keeps the original lazy image fallback for non-video callers', () => {
		const src = {
			sources: { webp: '/feature.webp' },
			img: { src: '/feature.webp', w: 960, h: 720 }
		} as unknown as Picture;
		const { body } = render(ImgDemo, {
			props: { title: 'Plan', children: description, src }
		});
		expect(body).toContain('<img');
		expect(body).toContain('alt="Plan"');
		expect(body).toContain('loading="lazy"');
		expect(body).not.toContain('<video');
	});
});
