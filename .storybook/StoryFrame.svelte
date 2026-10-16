<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cms } from '../src/lib/content';
	import { content } from './mocks/preferences.svelte';

	let {
		theme,
		language,
		children
	}: {
		theme: string;
		language: string;
		children: Snippet;
	} = $props();

	// Storybook evaluates decorators inside Svelte's render computation. Sync
	// shared mock state from a component effect, never from that computation.
	$effect.pre(() => {
		const selected = language === 'he' ? cms.he : cms.en;
		content.lang = selected;
		document.documentElement.dataset.theme =
			theme === 'light' ? 'light' : 'dark';
		document.documentElement.lang = selected.lang;
		document.documentElement.dir = selected.dir;
	});
</script>

{@render children()}
