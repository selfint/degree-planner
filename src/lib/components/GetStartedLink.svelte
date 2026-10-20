<script lang="ts">
	import { navigating } from '$app/state';
	import { content } from '$lib/preferences.svelte';
	import Spinner from './Spinner.svelte';

	const pending = $derived(
		navigating.to?.url.pathname.startsWith('/app') ?? false
	);
</script>

<!-- Navigation must work before hydration, including slow Firebase startup. -->
<a
	href="/app/"
	data-sveltekit-reload
	aria-busy={pending}
	class="ui-button ui-button--primary min-h-11 px-5 text-white"
>
	{content.lang.common.getStarted}
	{#if pending}
		<span class="h-4 w-4" aria-hidden="true"><Spinner /></span>
	{/if}
</a>
