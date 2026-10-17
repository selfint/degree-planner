export type SignInErrorKind =
	| 'domain'
	| 'popup'
	| 'cancelled'
	| 'network'
	| 'unknown';

/** Do not display raw provider errors; they can include account-specific details. */
export function signInErrorKind(error: unknown): SignInErrorKind {
	const code =
		typeof error === 'object' && error !== null && 'code' in error
			? error.code
			: undefined;
	switch (code) {
		case 'auth/unauthorized-domain':
			return 'domain';
		case 'auth/popup-blocked':
		case 'auth/operation-not-supported-in-this-environment':
			return 'popup';
		case 'auth/popup-closed-by-user':
		case 'auth/cancelled-popup-request':
			return 'cancelled';
		case 'auth/network-request-failed':
			return 'network';
		default:
			return 'unknown';
	}
}
