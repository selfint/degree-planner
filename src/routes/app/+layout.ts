import type { LayoutLoad } from './$types';
import { initFirebase } from '$lib/firebase.svelte';
import { bootstrapOfflinePublicData } from '$lib/offlineData';
export const ssr = false;
export const load: LayoutLoad = async () => {
	const [firebase, publicData] = await Promise.all([
		initFirebase(),
		bootstrapOfflinePublicData()
	]);
	return { firebase, publicData };
};
