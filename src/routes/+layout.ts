import type { LayoutLoad } from './$types';

import { initFirebase } from '$lib/firebase.svelte';

export const load: LayoutLoad = async () => {
	return await initFirebase();
};
