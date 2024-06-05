<script lang="ts">
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import '../app.css';

	import { userData } from '$lib/stores';
	import { goto } from '$app/navigation';

	import TitleBar from '$lib/components/TitleBar.svelte';

	injectSpeedInsights();
</script>

<TitleBar
	userData={$userData}
	onGetStarted={() => goto('/user')}
	onSearch={(query) => goto(`/search?q=${query}`)}
/>

<div class="p-3">
	<slot />
</div>

<style lang="postcss">
	:global(body) {
		@apply bg-background;
	}
</style>
