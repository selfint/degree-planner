import type { LayoutLoad } from './$types';

import { initFirebase } from '$lib/firebase.svelte';

export const load: LayoutLoad = () => {
	return {
		firebase: initFirebase()
	};
};
