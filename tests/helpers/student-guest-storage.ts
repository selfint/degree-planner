export function initializeGuestStorage({
	origin,
	language,
	seed
}: {
	origin: string;
	language: string;
	seed?: unknown;
}) {
	// New tabs first run init scripts in opaque about:blank documents. Never
	// touch their storage, or any third-party frame's storage, before navigation.
	if (window.location.origin !== origin) return;
	// A reload/new tab must preserve student edits rather than reseed the plan.
	if (window.localStorage.getItem('student-journey-initialized') !== null)
		return;
	window.localStorage.setItem('student-journey-initialized', 'true');
	window.localStorage.setItem('lang', language);
	if (seed) {
		window.localStorage.setItem('version', '4');
		window.localStorage.setItem('userData', JSON.stringify(seed));
	}
}
