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
	class="inline-flex h-full items-center justify-center gap-2 rounded-md border border-transparent bg-accent-primary px-3 py-0.5 leading-tight text-content-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary"
>
	{content.lang.common.getStarted}
	{#if pending}
		<span class="h-4 w-4" aria-hidden="true"><Spinner /></span>
	{/if}
</a>
