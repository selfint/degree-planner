<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page, navigating } from '$app/state';
	import { content } from '$lib/preferences.svelte';
	import TitleBar from './components/TitleBar.svelte';
	import AppFooter from '$lib/components/AppFooter.svelte';
	import ConsoleLoading from '$lib/components/ConsoleLoading.svelte';
	import { shouldShowConsoleEntry } from '$lib/consoleNavigation';
	const buildCommit = __PLANIT_BUILD_SHA__;
	const { children } = $props();
	const consoleRoute = $derived(/^\/app(?:\/|$)/.test(page.url.pathname));
	const openingConsole = $derived(
		shouldShowConsoleEntry(page.url.pathname, navigating.to?.url.pathname)
	);
	onMount(() => {
		document.getElementById('console-boot')?.remove();
	});
</script>

<svelte:head>
	{#if buildCommit}
		<meta name="planit-build" content={buildCommit} />
	{/if}
</svelte:head>

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
	<div class="fixed inset-0 z-50" data-testid="console-entry-loading">
		<ConsoleLoading language={content.lang.lang} phase="opening" />
	</div>
{/if}

<style lang="postcss">
	:global(body) {
		background: rgb(var(--color-background));
		overscroll-behavior-y: none;
	}
</style>
