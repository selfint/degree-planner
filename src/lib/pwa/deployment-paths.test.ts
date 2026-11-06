import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isAppUpdateRegistration } from './entry-update';

it.each(['', '/degree-planner'])(
	'resolves manifest resources within deployment %s',
	(base) => {
		const manifest = JSON.parse(
			readFileSync('static/manifest.webmanifest', 'utf8')
		);
		const location = `https://example.test${base}/manifest.webmanifest`;
		expect(new URL(manifest.start_url, location).pathname).toBe(`${base}/app/`);
		expect(new URL(manifest.scope, location).pathname).toBe(`${base}/app/`);
		for (const icon of manifest.icons)
			expect(new URL(icon.src, location).pathname).toMatch(
				new RegExp(`^${base}/icons/`)
			);
	}
);
it('only recognizes the project’s own worker registration', () => {
	const origin = 'https://example.test';
	const base = '/degree-planner';
	const registration = {
		scope: `${origin}${base}/app/`,
		active: { scriptURL: `${origin}${base}/service-worker.js` },
		waiting: null,
		installing: null
	} as unknown as ServiceWorkerRegistration;
	expect(isAppUpdateRegistration(registration, origin, base)).toBe(true);
	expect(isAppUpdateRegistration(registration, origin)).toBe(false);
	expect(
		isAppUpdateRegistration(
			{ ...registration, scope: `${origin}/app/` },
			origin,
			base
		)
	).toBe(false);
});

it('preserves the root app identity using the start URL origin, not the manifest directory', () => {
	const manifest = JSON.parse(
		readFileSync('static/manifest.webmanifest', 'utf8')
	);
	expect(manifest.id).toBe('/');
	for (const base of ['', '/degree-planner']) {
		const manifestURL = `https://example.test${base}/manifest.webmanifest`;
		const startURL = new URL(manifest.start_url, manifestURL);
		// Manifest IDs resolve against the start URL origin. The Pages finalizer
		// writes a project-specific absolute path into the deployed artifact.
		expect(new URL(manifest.id, `${startURL.origin}/`).href).toBe(
			'https://example.test/'
		);
		expect(new URL('./', `${startURL.origin}/`).pathname).toBe('/');
	}
});
