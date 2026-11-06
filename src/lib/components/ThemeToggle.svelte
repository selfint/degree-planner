<script lang="ts">
	import { onMount } from 'svelte';
	import { content } from '$lib/preferences.svelte';
	import {
		applyTheme,
		parseThemePreference,
		saveTheme,
		themeStorageKey,
		watchSystemTheme,
		type ThemePreference
	} from '$lib/theme';

	let { compact = false }: { compact?: boolean } = $props();
	let theme = $state<ThemePreference>('dark');
	let ready = $state(false);
	const label = $derived(content.lang.header.theme);

	onMount(() => {
		theme = parseThemePreference(
			document.documentElement.dataset.themePreference ??
				document.documentElement.dataset.theme
		);
		const stopWatching = watchSystemTheme();
		const observer = new MutationObserver(() => {
			theme = parseThemePreference(
				document.documentElement.dataset.themePreference ??
					document.documentElement.dataset.theme
			);
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme-preference']
		});
		ready = true;

		function syncTheme(event: StorageEvent) {
			if (event.key === themeStorageKey || event.key === null) {
				theme = parseThemePreference(event.newValue);
				applyTheme(theme);
			}
		}

		window.addEventListener('storage', syncTheme);
		return () => {
			window.removeEventListener('storage', syncTheme);
			stopWatching();
			observer.disconnect();
		};
	});
</script>

<div
	style:--theme-toggle-size={compact ? '2.25rem' : '2.75rem'}
	class="theme-toggle relative flex shrink-0 items-center justify-center rounded-md border border-border text-content-secondary hover:bg-card-primary hover:text-content-primary"
>
	<select
		class="theme-select absolute cursor-pointer opacity-0"
		disabled={!ready}
		aria-label={label}
		title={label}
		bind:value={theme}
		onchange={(event) =>
			saveTheme(parseThemePreference(event.currentTarget.value))}
	>
		<option value="dark">{content.lang.header.themeDark}</option>
		<option value="light">{content.lang.header.themeLight}</option>
		<option value="system">{content.lang.header.themeSystem}</option>
	</select>
	<svg
		aria-hidden="true"
		class="pointer-events-none h-4 w-4"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.75"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		{#if theme === 'system'}
			<rect x="3" y="4" width="18" height="13" rx="2" />
			<path d="M8 21h8m-4-4v4" />
		{:else if theme === 'light'}
			<circle cx="12" cy="12" r="4" />
			<path
				d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"
			/>
		{:else}
			<path d="M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z" />
		{/if}
	</svg>
</div>

<style>
	.theme-toggle {
		inline-size: var(--preference-control-width, var(--theme-toggle-size));
		block-size: var(--preference-control-height, var(--theme-toggle-size));
	}
	.theme-select {
		font-size: 16px;
		inset: -1px;
		inline-size: calc(100% + 2px);
		block-size: calc(100% + 2px);
	}
	.theme-toggle:focus-within {
		outline: 2px solid rgb(var(--color-accent-primary));
		outline-offset: 2px;
	}
</style>
