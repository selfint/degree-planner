<script lang="ts">
	import { onMount } from 'svelte';
	import { content } from '$lib/preferences.svelte';
	import { parseTheme, type Theme } from '$lib/theme';
	import { tutorialCopy, type TutorialTopic } from '$lib/tutorials';
	import TutorialVideo from './TutorialVideo.svelte';

	let theme = $state<Theme>('dark');
	let hydrated = $state(false);
	const language = $derived(content.lang.lang === 'en' ? 'en' : 'he');
	const copy = $derived(tutorialCopy[language]);
	const topics: TutorialTopic[] = ['course-card', 'plan-course'];

	onMount(() => {
		const syncTheme = () =>
			(theme = parseTheme(document.documentElement.dataset.theme));
		syncTheme();
		// Native media can retain the source selected from server HTML even when
		// hydration updates its <source> attributes. Recreate once with the real
		// device preferences, without calling load() or fetching video bytes.
		hydrated = true;
		const observer = new MutationObserver(syncTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});
		return () => observer.disconnect();
	});
</script>

<section
	data-testid="landing-tutorials"
	dir={content.lang.dir}
	aria-labelledby="tutorials-title"
	class="min-w-0 border-t border-border pt-10 md:pt-12"
>
	<h2
		id="tutorials-title"
		class="text-2xl font-semibold leading-snug tracking-tight text-content-primary sm:text-3xl"
	>
		{copy.title}
	</h2>
	<p class="mt-3 text-base leading-relaxed text-content-secondary">
		{copy.intro}
	</p>
	<div class="mt-8 space-y-12 sm:mt-10 sm:space-y-16">
		{#each topics as topic}
			{#key `${topic}-${language}-${theme}-${hydrated}`}
				<TutorialVideo {topic} {language} {theme} />
			{/key}
		{/each}
	</div>
</section>
