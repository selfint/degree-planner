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

<div class="fixed left-0 top-0 z-50 h-16 w-full bg-background">
	<TitleBar
		username={$username}
		{onGetStarted}
		onSearch={(query) => goto(`/search?q=${query}`)}
	/>
</div>
<div class="pb-16" />

<slot />

<style lang="postcss">
	:global(body) {
		@apply bg-background;
	}
</style>
