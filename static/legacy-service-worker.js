// Compatibility for an already installed icon whose start URL is still /plan.
// Registered only when replacing this app's former root worker, after the new
// /app/ shell is verified. Never caches data, intercepts landing, claims clients,
// or activates over an old tab with unsaved edits.
self.addEventListener('fetch', (rawEvent) => {
	const event =
		/** @type {Event & {request: Request, respondWith(response: Promise<Response>): void}} */ (
			rawEvent
		);
	const url = new URL(event.request.url);
	if (
		event.request.method === 'GET' &&
		event.request.mode === 'navigate' &&
		url.origin === self.location.origin &&
		/^\/(?:plan|settings|catalog|semester|search|course|preview|offline)(?:\/|$)/.test(
			url.pathname
		)
	) {
		event.respondWith(
			Promise.resolve(
				Response.redirect(`${url.origin}/app${url.pathname}${url.search}`, 302)
			)
		);
	}
});
