<script lang="ts">
	import { onMount } from 'svelte';
	import { content } from '$lib/preferences.svelte';
	import { parseTheme, type Theme } from '$lib/theme';
	import type { mediaGroups } from '$lib/tutorialMedia';
	import NativeVideo from './NativeVideo.svelte';

	let {
		topic,
		title
	}: {
		topic: (typeof mediaGroups.features)[number];
		title: string;
	} = $props();
	let theme = $state<Theme>('dark');
	let hydrated = $state(false);
	const language = $derived(content.lang.lang === 'en' ? 'en' : 'he');
	const source = $derived(`/tutorials/${topic}-${language}-${theme}`);
	onMount(() => {
		const syncTheme = () =>
			(theme = parseTheme(document.documentElement.dataset.theme));
		syncTheme();
		hydrated = true;
		const observer = new MutationObserver(syncTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});
		return () => observer.disconnect();
	});
</script>

<div data-testid={topic} class="min-w-0">
	<!-- Native media must be recreated when preferences change, not just its source attributes. -->
	{#key `${source}-${hydrated}`}
		<NativeVideo
			{source}
			{title}
			{language}
			captions={language === 'he' ? 'תיאורים בעברית' : 'English descriptions'}
			unavailable={language === 'he'
				? 'לא ניתן לטעון את הסרטון. התיאור עדיין זמין לצד הסרטון.'
				: 'The video could not load. The feature description is still available beside it.'}
		/>
	{/key}
</div>
