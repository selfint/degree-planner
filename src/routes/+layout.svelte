<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page, navigating } from '$app/state';
	import { content } from '$lib/preferences.svelte';
	import TitleBar from './components/TitleBar.svelte';
	import AppFooter from '$lib/components/AppFooter.svelte';
	const { children } = $props();
	const consoleRoute = $derived(/^\/app(?:\/|$)/.test(page.url.pathname));
	const openingConsole = $derived(
		navigating.to?.url.pathname.startsWith('/app')
	);
	onMount(() => {
		document.getElementById('console-boot')?.remove();
	});
</script>

{#if consoleRoute}
	{@render children()}
{:else}
	<div dir={content.lang.dir} class="flex min-h-screen flex-col">
		<div class="border-b border-border bg-background">
			<TitleBar
				started={false}
				searchQuery=""
				searchRevision={0}
				onSearch={() => {}}
			/>
		</div>
		<main class="flex-grow">{@render children()}</main>
		<AppFooter />
	</div>
{/if}
{#if openingConsole}
	<div
		role="status"
		class="fixed inset-0 z-50 grid place-content-center bg-background text-content-primary"
	>
		{content.lang.lang === 'he' ? 'פותחים את PlanIt…' : 'Opening PlanIt…'}
	</div>
{/if}

<style lang="postcss">
	:global(body) {
		background: rgb(var(--color-background));
		overscroll-behavior-y: none;
	}
</style>
