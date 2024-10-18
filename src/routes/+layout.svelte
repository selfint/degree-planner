<script lang="ts">
	// import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { inject } from '@vercel/analytics';

	import '../app.css';

	import { goto } from '$app/navigation';

	import { user, content } from '$lib/stores.svelte';

	import { cms } from '$lib/content';

	import TitleBar from './components/TitleBar.svelte';
	import Select from '$lib/components/Select.svelte';

	// injectSpeedInsights();
	inject();

	const { children } = $props();

	function onchangeLang(newValue: (typeof cms)[keyof typeof cms]): void {
		localStorage.setItem('lang', newValue.lang);
	}
</script>

<div dir={content.lang.dir} class="flex h-full min-h-screen flex-col">
	<div class="w-full border-b-2 border-border bg-background">
		<TitleBar
			started={user.semesters.length > 0}
			onGetStarted={() => goto('/progress')}
			onSearch={(query) => goto(`/search?q=${query}`)}
		/>
	</div>

	<main class="flex-grow">
		{@render children()}
	</main>

	<footer
		class="flex flex-row items-baseline justify-between border-t-2 border-border bg-background p-4 text-sm"
	>
		<p class="text-content-secondary sm:flex-row sm:space-x-2">
			{content.lang.footer.createdBy}
			<a
				href="https://github.com/selfint"
				target="_blank"
				class="text-blue-400 hover:text-content-primary"
			>
				{content.lang.footer.author}
			</a>
		</p>

		<div>
			<Select bind:value={content.lang} onchange={onchangeLang}>
				{#each Object.entries(cms) as [key, value]}
					<option {value}>{key}</option>
				{/each}
			</Select>
		</div>

		<div class="flex flex-row">
			<a
				target="_blank"
				href="https://github.com/selfint/degree-planner/issues/new/choose"
				class="text-content-secondary hover:text-content-primary ltr:mr-2 rtl:ml-2"
			>
				{content.lang.footer.reportIssue}
			</a>
			<a
				href="https://github.com/selfint/degree-planner"
				target="_blank"
				class="text-content-secondary hover:text-content-primary"
			>
				<!-- GitHub Icon -->
				<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
					<path
						d="M12 0C5.37 0 0 5.37 0 12a12 12 0 008.19 11.46c.6.11.82-.26.82-.58v-2.12c-3.33.73-4.03-1.61-4.03-1.61-.55-1.42-1.34-1.8-1.34-1.8-1.1-.75.08-.73.08-.73 1.21.09 1.85 1.25 1.85 1.25 1.08 1.84 2.83 1.31 3.52 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 016 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.92 1.24 3.23 0 4.61-2.81 5.62-5.48 5.91.43.37.81 1.1.81 2.21v3.28c0 .33.22.7.83.58A12 12 0 0024 12c0-6.63-5.37-12-12-12z"
					/>
				</svg>
			</a>
		</div>
	</footer>
</div>

<style lang="postcss">
	:global(body) {
		@apply bg-background;
		overscroll-behavior-y: none;
	}
</style>
