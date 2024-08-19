<script lang="ts">
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { inject } from '@vercel/analytics';

	import '../app.css';

	import { username, storesHook, loadStores } from '$lib/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	import { browser } from '$app/environment';

	import TitleBar from '$lib/components/TitleBar.svelte';

	injectSpeedInsights();
	inject();

	function onGetStarted() {
		goto('/user');
	}

	onMount(() => {
		if (browser) {
			loadStores();
		}

		storesHook();
	});
</script>

<div class="w-full bg-background">
	<TitleBar
		username={$username}
		{onGetStarted}
		onSearch={(query) => goto(`/search?q=${query}`)}
	/>
</div>

<slot />

<style lang="postcss">
	:global(body) {
		@apply bg-background;
		overscroll-behavior-y: none;
	}
</style>
