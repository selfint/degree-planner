import { describe, expect, it } from 'vitest';
import { pagesManifest } from './finalizePages.mjs';

const source = {
	id: '/',
	start_url: './app/',
	scope: './app/',
	icons: [{ src: './icons/icon-192.png' }]
};
describe('Pages app identity', () => {
	for (const base of ['', '/degree-planner', '/another-staging-site']) {
		it(`keeps app identity within ${base || 'root'}`, () => {
			const manifest = pagesManifest(source, base);
			const manifestURL = new URL(
				`https://example.com${base}/manifest.webmanifest`
			);
			const start = new URL(manifest.start_url, manifestURL);
			expect(new URL(manifest.id, start.origin).href).toBe(
				`https://example.com${base}/`
			);
			expect(new URL(manifest.scope, manifestURL).pathname).toBe(
				`${base}/app/`
			);
			expect(source.id).toBe('/');
		});
	}
});
