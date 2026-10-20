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
	it('replaces only the media while preserving the original grid, heading and paragraph', () => {
		const { body } = render(ImgDemo, {
			props: { title: 'Search courses', children: description, media }
		});
		expect(body).toContain('md:grid-cols-[minmax(0,1fr)_17rem]');
		expect(body).toContain('md:order-2');
		expect(body).toContain('md:order-1');
		expect(body).toMatch(/<h2[^>]*>Search courses<\/h2>/);
		expect(body).toMatch(
			/<p[^>]*>[\s\S]*Existing feature description[\s\S]*<\/p>/
		);
		expect(body).toContain('data-testid="replacement-media"');
		expect(body).not.toContain('<img');
		expect((body.match(/<section/g) ?? []).length).toBe(1);
	});
	it('keeps the original lazy image fallback for the other six slots', () => {
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
