import { expect, it } from 'vitest';
import { signInErrorKind } from './sign-in-error';

it.each([
	['auth/unauthorized-domain', 'domain'],
	['auth/popup-blocked', 'popup'],
	['auth/operation-not-supported-in-this-environment', 'popup'],
	['auth/popup-closed-by-user', 'cancelled'],
	['auth/cancelled-popup-request', 'cancelled'],
	['auth/network-request-failed', 'network'],
	['auth/internal-error', 'unknown']
])('classifies %s without exposing provider details', (code, expected) => {
	expect(signInErrorKind({ code, message: 'private provider details' })).toBe(
		expected
	);
});

it('handles arbitrary failures safely', () => {
	for (const error of [
		undefined,
		null,
		'network',
		new Error('private details')
	])
		expect(signInErrorKind(error)).toBe('unknown');
});
