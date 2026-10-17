import { describe, expect, it } from 'vitest';
import { legacyConsoleDestination } from './consoleRoutes';
describe('legacy console routes', () => {
	it.each([
		'plan',
		'settings',
		'catalog',
		'semester',
		'search',
		'course/02340124',
		'preview/2024_200/00002120/SC00001320_CG00006382'
	])('preserves %s, query and hash', (route) => {
		expect(
			legacyConsoleDestination(
				new URL(`https://example.test/${route}?q=a%20b&path=x#section`)
			)
		).toBe(`/app/${route}?q=a%20b&path=x#section`);
	});
	it.each(['/', '/en', '/app/plan', '/api/user', '/planet'])(
		'does not redirect %s',
		(path) => {
			expect(
				legacyConsoleDestination(new URL(path, 'https://example.test'))
			).toBeUndefined();
		}
	);
});
