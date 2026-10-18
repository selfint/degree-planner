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
	<div class="footer-main">
		<div class="footer-links">
			<p class="footer-credit">
				{content.lang.footer.createdBy}
				<a
					class="footer-author"
					href="https://github.com/selfint"
					target="_blank"
					rel="noopener noreferrer">{content.lang.footer.author}</a
				>
			</p>
			<a
				class="footer-report"
				href="https://github.com/selfint/degree-planner/issues/new/choose"
				target="_blank"
				rel="noopener noreferrer">{content.lang.footer.reportIssue}</a
			>
		</div>
		<div
			class="preference-controls flex items-center gap-2"
			style:--preference-control-height={compact ? '2.25rem' : '2.75rem'}
		>
			<ThemeToggle {compact} />
			<label class="language-control">
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
	.footer-main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		max-inline-size: 76rem;
		margin-inline: auto;
	}
	.footer-links {
		display: grid;
		justify-items: start;
		min-inline-size: 0;
		font-size: 0.75rem;
		line-height: 1.5;
		color: rgb(var(--color-content-secondary));
	}
	.footer-credit {
		margin: 0;
	}
	.footer-author,
	.footer-report {
		text-underline-offset: 0.125rem;
	}
	.footer-author:hover,
	.footer-report:hover {
		color: rgb(var(--color-content-primary));
		text-decoration: underline;
	}

	.preference-controls {
		--preference-control-width: 3rem;
	}
	.language-control {
		inline-size: var(--preference-control-width);
		flex: none;
	}
	.language-control :global(select) {
		block-size: var(--preference-control-height);
		min-block-size: 0;
		padding: 0;
		text-align: center;
		text-align-last: center;
		white-space: nowrap;
	}

	.pwa-footer-row {
		max-inline-size: 76rem;
		min-inline-size: 0;
		margin: 0.25rem auto 0;
	}
</style>
