import type { LayoutLoad } from './$types';
import { initFirebase } from '$lib/firebase.svelte';
import { prepareOfflinePublicData } from '$lib/offlineData';
export const ssr = false;
export const load: LayoutLoad = async () => {
	const [firebase, publicData] = await Promise.all([
		initFirebase(),
		prepareOfflinePublicData()
	]);
	return { firebase, publicData };
};
