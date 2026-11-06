import type { Handle } from '@sveltejs/kit';

const PUBLIC_DATA_RESPONSE_HEADERS = new Set([
	'cache-control',
	'content-type',
	'etag',
	'last-modified'
]);

// Hydration reuses SSR fetch responses. Preserve only cache-policy metadata so
// the browser repository cannot accidentally persist a private/no-store payload
// merely because SvelteKit omitted its response headers from the inline result.
export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			PUBLIC_DATA_RESPONSE_HEADERS.has(name.toLowerCase())
	});
