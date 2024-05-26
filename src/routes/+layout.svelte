<script>
	import '../app.css';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	injectSpeedInsights();
</script>

<slot />

<style lang="postcss">
	:global(body) {
		@apply bg-teal-100 dark:bg-teal-100;
	}
</style>
