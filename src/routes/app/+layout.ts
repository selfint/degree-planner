import type { LayoutLoad } from './$types';
import { initFirebase } from '$lib/firebase.svelte';
import { bootstrapOfflinePublicData } from '$lib/offlineData';
import { reportConsoleLoading } from '$lib/consoleLoading';
export const ssr = false;
let generation = 0;
export const load: LayoutLoad = async () => {
	let active = true;
	const currentGeneration = ++generation;
	const current = () => active && generation === currentGeneration;
	reportConsoleLoading({ phase: 'checking' });
	try {
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
