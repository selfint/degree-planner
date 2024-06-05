<script lang="ts">
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import '../app.css';

	import TitleBar from '$lib/components/TitleBar.svelte';

	injectSpeedInsights();
</script>

<TitleBar />

<slot />

<style lang="postcss">
	:global(body) {
		@apply bg-background;
	}
</style>
