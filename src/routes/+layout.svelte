<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page, navigating } from '$app/state';
	import { content } from '$lib/preferences.svelte';
	import { cms } from '$lib/content';
	import TitleBar from './components/TitleBar.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Select from '$lib/components/Select.svelte';
	const { children } = $props();
	const consoleRoute = $derived(/^\/app(?:\/|$)/.test(page.url.pathname));
	const openingConsole = $derived(
		navigating.to?.url.pathname.startsWith('/app')
	);
	onMount(() => {
		document.getElementById('console-boot')?.remove();
	});
	function changeLanguage(value: (typeof cms)[keyof typeof cms]) {
		try {
			localStorage.setItem('lang', value.lang);
		} catch {
			/* In-memory preference still works. */
		}
	}
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
		<footer
			class="flex flex-wrap items-center justify-between gap-3 border-t-2 border-border bg-background p-3 text-sm"
		>
			<p class="text-content-secondary">
				{content.lang.footer.createdBy}
				<a class="text-link" href="https://github.com/selfint"
					>{content.lang.footer.author}</a
				>
			</p>
			<div class="flex items-center gap-2">
				<ThemeToggle />
				<Select bind:value={content.lang} onchange={changeLanguage}>
					<option value={cms.en}>en</option><option value={cms.he}>עב</option>
				</Select>
			</div>
			<a
				class="text-content-secondary"
				href="https://github.com/selfint/degree-planner/issues/new/choose"
				>{content.lang.footer.reportIssue}</a
			>
		</footer>
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
