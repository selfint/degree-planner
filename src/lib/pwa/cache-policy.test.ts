import { describe, expect, it } from 'vitest';
import { isAppNavigation } from './cache-policy';

describe('PWA shell boundary', () => {
	it('only serves the offline shell for real app routes', () => {
		for (const path of [
			'/plan',
			'/settings',
			'/course/02340124',
			'/preview/2024_200/00002120/SC00001320_CG00006382'
		])
			expect(isAppNavigation(path)).toBe(true);
		for (const path of [
			'/api/me',
			'/__auth/handler',
			'/service-worker.js',
			'/missing'
		])
			expect(isAppNavigation(path)).toBe(false);
	});
});
