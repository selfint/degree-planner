import { redirect } from '@sveltejs/kit';
import { withBase } from './deploymentPaths';
import { user } from './stores.svelte';

/** Keep cold manifest entry and an already-mounted console's entry link aligned. */
export function redirectConsoleEntry(): never {
	redirect(307, withBase(user.d.degree ? '/app/plan' : '/app/settings'));
}
