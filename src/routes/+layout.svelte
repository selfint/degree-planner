<script lang="ts">
	import '../app.css';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import { loadStores, storeHook } from '$lib/stores';
	import { onMount } from 'svelte';

	injectSpeedInsights();

	onMount(() => {
		loadStores();
		storeHook();
	});
</script>

<slot />

<style lang="postcss">
	:global(body) {
		@apply bg-teal-100 dark:bg-teal-100;
	}
</style>
