import { describe, expect, it } from 'vitest';
import { intentionalWebKitFetchDiagnostic } from '../tests/helpers/student-journey-diagnostics';

const url =
	'https://firebase.googleapis.com/v1alpha/projects/-/apps/test-app/webConfig';
const firstLine = `Fetch API cannot load ${url} due to access control checks.`;
const diagnostic = {
	// Playwright splits WebKit's message at the first colon plus two characters.
	name: 'Fetch API cannot load https',
	message: firstLine.slice(firstLine.indexOf(':') + 2),
	stack: `${firstLine}\n    at fetchDynamicConfig (http://localhost/app.js:1:1)`
};

describe('intentional WebKit blocked-request diagnostics', () => {
	it('recognizes only the exact public-config diagnostic for an aborted URL', () => {
		expect(
			intentionalWebKitFetchDiagnostic('webkit', diagnostic, new Set([url]))
		).toBe(url);
	});

	it.each([
		['no abort evidence', new Set()],
		['another aborted URL', new Set([`${url}?different`])]
	])('rejects %s', (_, aborted) => {
		expect(
			intentionalWebKitFetchDiagnostic('webkit', diagnostic, aborted)
		).toBeUndefined();
	});

	it('does not classify the message in another browser', () => {
		expect(
			intentionalWebKitFetchDiagnostic('chromium', diagnostic, new Set([url]))
		).toBeUndefined();
	});

	it('does not exempt another endpoint even if the test aborted it', () => {
		const other = 'https://example.com/private-data';
		const line = `Fetch API cannot load ${other} due to access control checks.`;
		expect(
			intentionalWebKitFetchDiagnostic(
				'webkit',
				{
					...diagnostic,
					message: line.slice(line.indexOf(':') + 2),
					stack: line
				},
				new Set([other])
			)
		).toBeUndefined();
	});

	it.each([
		{ name: 'TypeError', message: 'Cannot read properties of undefined' },
		{ ...diagnostic, message: 'An unrelated error' },
		{ ...diagnostic, name: 'Unhandled Promise Rejection' },
		{ ...diagnostic, stack: undefined },
		{ ...diagnostic, stack: `${firstLine} Extra failure` }
	])('preserves unrelated or incomplete errors: %j', (error) => {
		expect(
			intentionalWebKitFetchDiagnostic('webkit', error, new Set([url]))
		).toBeUndefined();
	});
});
