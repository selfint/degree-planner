import { describe, expect, it } from 'vitest';
import { shouldShowConsoleEntry } from './consoleNavigation';

describe('console entry presentation', () => {
	it('shows startup when entering the console from the landing', () => {
		expect(shouldShowConsoleEntry('/', '/app/settings')).toBe(true);
	});
	it.each(['/app', '/app/', '/app/plan', '/app/catalog', '/app/search'])(
		'keeps %s client navigation free of the startup overlay',
		(current) => {
			for (const destination of [
				'/app/settings',
				'/app/catalog',
				'/app/plan',
				'/app/course/02340124'
			]) {
				expect(shouldShowConsoleEntry(current, destination)).toBe(false);
			}
		}
	);
	it('does not treat unrelated paths or settled navigation as entry', () => {
		expect(shouldShowConsoleEntry('/', '/application')).toBe(false);
		expect(shouldShowConsoleEntry('/app/plan', '/')).toBe(false);
		expect(shouldShowConsoleEntry('/')).toBe(false);
	});
});
