<script lang="ts">
	import { resolve } from '$app/paths';
	import { navigating } from '$app/state';
	import { content } from '$lib/preferences.svelte';
	import Spinner from './Spinner.svelte';
	import { trackEvent } from '$lib/analytics';

	const pending = $derived(
		navigating.to?.url.pathname.startsWith(resolve('/app')) ?? false
	);
</script>

<!-- Navigation must work before hydration, including slow Firebase startup. -->
<a
	href={resolve('/app/')}
	onclick={() => trackEvent('start_clicked')}
	data-sveltekit-reload
	aria-busy={pending}
	class="ui-button ui-button--primary min-h-11 px-5"
>
	{content.lang.common.getStarted}
	{#if pending}
		<span class="h-4 w-4" aria-hidden="true"><Spinner /></span>
	{/if}
</a>
