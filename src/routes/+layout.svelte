<script lang="ts">
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import '../app.css';

	import { username } from '$lib/stores';
	import { goto } from '$app/navigation';

	import TitleBar from '$lib/components/TitleBar.svelte';

	injectSpeedInsights();

	function onGetStarted() {
		goto('/user');
	}
</script>

<TitleBar username={$username} {onGetStarted} onSearch={(query) => goto(`/search?q=${query}`)} />

<div class="p-3">
	<slot />
</div>

<style lang="postcss">
	:global(body) {
		@apply bg-background;
	}
</style>
