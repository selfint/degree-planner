<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page, navigating } from '$app/state';
	import { content } from '$lib/preferences.svelte';
	import TitleBar from './components/TitleBar.svelte';
	import AppFooter from '$lib/components/AppFooter.svelte';
	import ConsoleLoading from '$lib/components/ConsoleLoading.svelte';
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
	<div class="fixed inset-0 z-50">
		<ConsoleLoading language={content.lang.lang} phase="opening" />
	</div>
{/if}

<style lang="postcss">
	:global(body) {
		background: rgb(var(--color-background));
		overscroll-behavior-y: none;
	}
</style>
