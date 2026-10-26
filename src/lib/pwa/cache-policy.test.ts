import { describe, expect, it } from 'vitest';
import { isAppNavigation } from './cache-policy';

describe('PWA shell boundary', () => {
	it('pins the entire app document namespace, not marketing or API routes', () => {
		for (const path of [
			'/app/plan',
			'/app/plan/',
			'/app/settings/',
			'/app/future-route',
			'/app/settings',
			'/app/course/02340124',
			'/app/preview/2024_200/00002120/SC00001320_CG00006382'
		])
			expect(isAppNavigation(path)).toBe(true);
		for (const path of [
			'/',
			'/en',
			'/plan',
			'/api/me',
			'/__auth/handler',
			'/service-worker.js',
			'/missing',
			'/application',
			'/app-like'
		])
			expect(isAppNavigation(path)).toBe(false);
	});
});

import { isImmutableAppAsset } from './cache-policy';
it('only permits immutable app file paths for retained-version fallback', () => {
	expect(isImmutableAppAsset('/_app/immutable/nodes/2.Ab12.js')).toBe(true);
	expect(isImmutableAppAsset('/_app/immutable/chunks/hkyq93-W.js')).toBe(true);
	expect(
		isImmutableAppAsset('/_app/immutable/workers/pdf.worker.B123.mjs')
	).toBe(true);
	expect(isImmutableAppAsset('/_app/immutable/assets/2.Ab12.css')).toBe(true);
	for (const path of [
		'/app/offline',
		'/courseData.json',
		'/_app/version.json',
		'/service-worker.js',
		'/_app/immutable/../secret'
	])
		expect(isImmutableAppAsset(path)).toBe(false);
});
