import { withBase } from '$lib/deploymentPaths';
import { redirect } from '@sveltejs/kit';
import { user } from '$lib/stores.svelte';
export const trailingSlash = 'always';
export const load = () =>
	redirect(307, withBase(user.d.degree ? '/app/plan' : '/app/settings'));
