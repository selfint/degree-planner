<script lang="ts">
	// import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { inject } from '@vercel/analytics';

	import '../app.css';

	import { user, persistUser } from '$lib/stores.svelte';
	import { goto } from '$app/navigation';

	import TitleBar from '$lib/components/TitleBar.svelte';

	// injectSpeedInsights();
	inject();

	function onGetStarted() {
		goto('/user');
	}

	$effect(() => persistUser());

	const { children } = $props();
</script>

<div class="w-full bg-background">
	<TitleBar
		username={user.username}
		{onGetStarted}
		onSearch={(query) => goto(`/search?q=${query}`)}
	/>
</div>

{@render children()}

<style lang="postcss">
	:global(body) {
		@apply bg-background;
		overscroll-behavior-y: none;
	}
</style>
