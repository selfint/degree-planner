<script>
	import '../app.css';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	injectSpeedInsights();
</script>

<slot />

<style lang="postcss">
	:global(body) {
		@apply bg-zinc-50 dark:bg-zinc-800;
	}
</style>
