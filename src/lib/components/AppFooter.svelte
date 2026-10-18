<script lang="ts">
	import type { Snippet } from 'svelte';
	import { content } from '$lib/preferences.svelte';
	import { cms } from '$lib/content';
	import ThemeToggle from './ThemeToggle.svelte';
	import Select from './Select.svelte';

	let {
		persistPreferences = true,
		compact = false,
		pwa
	}: {
		persistPreferences?: boolean;
		compact?: boolean;
		pwa?: Snippet;
	} = $props();

	function changeLanguage(value: (typeof cms)[keyof typeof cms]) {
		if (!persistPreferences) return;
		try {
			localStorage.setItem('lang', value.lang);
		} catch {
			// In-memory selection still works when preference storage is unavailable.
		}
	}
</script>

<footer
	class="border-t border-border bg-background {compact
		? 'px-3 py-2 text-xs'
		: 'px-4 py-4 text-sm sm:px-8'}"
>
	<div
		class="mx-auto flex max-w-[76rem] flex-wrap items-center justify-between gap-x-4 gap-y-1"
	>
		<div
			class="flex flex-wrap items-center gap-x-4 gap-y-1 text-content-secondary"
		>
			<p>
				{content.lang.footer.createdBy}
				<a
					class="font-medium text-content-primary underline decoration-border underline-offset-4 hover:decoration-accent-primary"
					href="https://github.com/selfint"
					target="_blank"
					rel="noopener noreferrer">{content.lang.footer.author}</a
				>
			</p>
			<a
				class="hover:text-content-primary hover:underline"
				href="https://github.com/selfint/degree-planner/issues/new/choose"
				target="_blank"
				rel="noopener noreferrer">{content.lang.footer.reportIssue}</a
			>
		</div>
		<div class="flex items-center gap-2">
			<ThemeToggle {compact} />
			<label class={compact ? '[&_select]:min-h-9' : '[&_select]:min-h-11'}>
				<span class="sr-only"
					>{content.lang.lang === 'he' ? 'שפה' : 'Language'}</span
				>
				<Select bind:value={content.lang} onchange={changeLanguage}>
					<option value={cms.en}>en</option>
					<option value={cms.he}>עב</option>
				</Select>
			</label>
		</div>
	</div>
	{#if pwa}
		<div class="pwa-footer-row" data-testid="pwa-footer-row">
			{@render pwa()}
		</div>
	{/if}
</footer>

<style>
	.pwa-footer-row {
		max-inline-size: 76rem;
		min-inline-size: 0;
		margin: 0.5rem auto 0;
		padding-block-start: 0.5rem;
		border-block-start: 0.0625rem solid rgb(var(--color-border));
	}
</style>
