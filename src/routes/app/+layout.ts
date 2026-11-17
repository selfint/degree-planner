import { redirectConsoleEntry } from '$lib/consoleEntry';
import { version } from '$app/environment';
import { base } from '$app/paths';
import { prepareEntryRelease } from '$lib/pwa/entry-preflight';
import type { LayoutLoad } from './$types';
import { initFirebase } from '$lib/firebase.svelte';
import { bootstrapOfflinePublicData } from '$lib/offlineData';
import { reportConsoleLoading } from '$lib/consoleLoading';
export const ssr = false;
// Emit real HTML for fixed console routes while dynamic course/share routes
// remain available through the static host's fallback.
export const prerender = 'auto';
let generation = 0;
export const load: LayoutLoad = async ({ route, untrack }) => {
	// Kit awaits parent data before handling a child redirect, then reruns this
	// unmounted layout for its destination. Resolve the manifest entry first so
	// it cannot finish bootstrap at 90% and start it again. Do not subscribe the
	// shared layout to route changes: internal navigation must retain its state.
	if (untrack(() => route.id) === '/app') redirectConsoleEntry();
	let active = true;
	const currentGeneration = ++generation;
	const current = () => active && generation === currentGeneration;
	reportConsoleLoading({ phase: 'checking' });
	try {
		await prepareEntryRelease(version, base);
		const [firebase, publicData] = await Promise.all([
			initFirebase(),
			bootstrapOfflinePublicData((progress) => {
				if (current()) reportConsoleLoading({ phase: 'data', ...progress });
			}).then((result) => {
				if (current()) reportConsoleLoading({ phase: 'finishing' });
				return result;
			})
		]);
		return { firebase, publicData };
	} catch (error) {
		if (current()) reportConsoleLoading({ phase: 'error' });
		throw error;
	} finally {
		active = false;
	}
};
