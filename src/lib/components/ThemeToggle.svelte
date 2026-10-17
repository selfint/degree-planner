<script lang="ts">
	import { onMount } from 'svelte';
	import { content } from '$lib/preferences.svelte';
	import {
		applyTheme,
		parseTheme,
		saveTheme,
		themeStorageKey,
		type Theme
	} from '$lib/theme';

	let theme = $state<Theme>('dark');
	let ready = $state(false);
	const label = $derived(content.lang.header.lightMode);

	onMount(() => {
		theme = parseTheme(document.documentElement.dataset.theme);
		ready = true;

		function syncTheme(event: StorageEvent) {
			if (event.key === themeStorageKey || event.key === null) {
				theme = parseTheme(event.newValue);
				applyTheme(theme);
			}
		}

		window.addEventListener('storage', syncTheme);
		return () => window.removeEventListener('storage', syncTheme);
	});

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		saveTheme(theme);
	}
</script>

<button
	type="button"
	disabled={!ready}
	aria-label={label}
	aria-pressed={theme === 'light'}
	title={theme === 'dark'
		? content.lang.header.switchToLight
		: content.lang.header.switchToDark}
	onclick={toggleTheme}
	class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-content-secondary hover:bg-card-primary hover:text-content-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary"
>
	<svg
		aria-hidden="true"
		class="h-5 w-5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.75"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		{#if theme === 'dark'}
			<circle cx="12" cy="12" r="4" />
			<path
				d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"
			/>
		{:else}
			<path d="M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z" />
		{/if}
	</svg>
</button>
