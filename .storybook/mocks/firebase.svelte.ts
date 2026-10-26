import { scenario } from './stores.svelte';
export async function signIn() {
	if (scenario.signInError) throw { code: 'auth/network-request-failed' };
}
