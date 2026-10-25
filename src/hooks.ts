import type { Reroute } from '@sveltejs/kit';
import { browserShareDestination } from '$lib/browserShareRoutes';

// This is an internal route alias, not a redirect: /share/ stays outside the
// installed app's /app/ scope, while preview loading/importing remains shared.
export const reroute: Reroute = ({ url }) =>
	browserShareDestination(url.pathname);
