<script lang="ts">
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import '../app.css';

	import Logo from '$lib/assets/logo.png';

	injectSpeedInsights();
</script>

<header class="flex flex-row items-center space-x-2 border-b-2 border-dark-400 p-1">
	<img src={Logo} alt="Logo" class="h-12" />
	<h1 class="text-4xl text-white">Degree catalog</h1>
	<div class="flex-grow"></div>
</header>

<slot />

<style lang="postcss">
	:global(body) {
		@apply bg-background;
	}
</style>
