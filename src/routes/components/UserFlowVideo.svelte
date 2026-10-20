<script lang="ts">
	import { onMount } from 'svelte';
	import { content } from '$lib/preferences.svelte';
	import {
		journeyTitles,
		journeyDescriptions,
		type JourneyTopic
	} from '$lib/journeyMedia';
	import recordings from '$lib/journeyRecordings.json';
	import NativeVideo from './NativeVideo.svelte';
	let { topic }: { topic: JourneyTopic } = $props();
	let theme = $state('dark');
	let hydrated = $state(false);
	const language = $derived(content.lang.lang === 'en' ? 'en' : 'he');
	const title = $derived(journeyTitles[topic][language]);
	const recording = $derived(
		(
			recordings as {
				topic: string;
				language: string;
				theme: string;
				source: string;
				commit: string;
				run: string;
				testFile: string;
			}[]
		).find(
			(r) => r.topic === topic && r.language === language && r.theme === theme
		)
	);
	onMount(() => {
		const sync = () =>
			(theme =
				document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
		sync();
		hydrated = true;
		const observer = new MutationObserver(sync);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});
		return () => observer.disconnect();
	});
</script>

<section
	class="mx-auto w-full max-w-4xl space-y-4"
	data-testid="student-journey-video"
>
	<h1 class="text-xl font-semibold">{title}</h1>
	<p class="text-sm text-content-secondary">
		{journeyDescriptions[topic][language]}
	</p>
	<p class="text-xs text-content-secondary">
		{language === 'he'
			? 'הקלטת בדיקה מבודדת עם אורח: עובדי שירות ורשת חיצונית חסומים בכוונה. הודעות הגדרת עבודה לא מקוונת ומסכי טעינה נשמרים כפי שהופיעו בבדיקה.'
			: 'Isolated guest test recording: service workers and external traffic are deliberately blocked. Offline-setup notices and reload screens are preserved as recorded.'}
	</p>
	{#if recording && hydrated}
		{#key recording.source}
			<NativeVideo
				source={recording.source}
				{title}
				{language}
				captions={language === 'he' ? 'תיאורים בעברית' : 'English descriptions'}
				unavailable={language === 'he'
					? 'לא ניתן לטעון את הסרטון.'
					: 'The recording could not be loaded.'}
			/>
		{/key}
		<p class="text-xs text-content-secondary">
			{language === 'he' ? 'מקור' : 'Source'}: {recording.testFile} ·
			<a
				href={`https://github.com/selfint/degree-planner/actions/runs/${recording.run}`}
				target="_blank"
				rel="noreferrer">CI {recording.run}</a
			>
			· {recording.commit.slice(0, 8)}
		</p>
	{/if}
</section>
