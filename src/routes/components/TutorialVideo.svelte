<script lang="ts">
	import { onMount } from 'svelte';
	import { tutorialCopy, type TutorialTopic } from '$lib/tutorials';
	import type { Theme } from '$lib/theme';

	let {
		topic,
		language,
		theme
	}: {
		topic: TutorialTopic;
		language: 'en' | 'he';
		theme: Theme;
	} = $props();
	const copy = $derived(tutorialCopy[language]);
	const tutorial = $derived(copy[topic]);
	const source = $derived(`/tutorials/${topic}-${language}-${theme}`);
	let video: HTMLVideoElement;
	let nearby = $state(false);
	let failed = $state(false);
	const failedSources = new Set<string>();

	function sourceFailed(format: string) {
		// Source errors do not bubble to the video. One failed format can still
		// fall back successfully; show the message only when both are exhausted.
		failedSources.add(format);
		if (failedSources.size === 2) failed = true;
	}

	onMount(() => {
		// Reserve the frame immediately, but fetch its poster only near the viewport.
		if (!('IntersectionObserver' in window)) {
			nearby = true;
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					nearby = true;
					observer.disconnect();
				}
			},
			{ rootMargin: '200px' }
		);
		observer.observe(video);
		return () => observer.disconnect();
	});
</script>

<article data-testid={`tutorial-${topic}`} class="min-w-0">
	<h3
		id={`${topic}-title`}
		class="text-xl font-semibold leading-snug text-content-primary sm:text-2xl"
	>
		{tutorial.title}
	</h3>
	<p class="mt-2 max-w-2xl text-base leading-relaxed text-content-secondary">
		{tutorial.description}
	</p>
	<div
		class="mt-5 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start lg:gap-8"
	>
		<div class="min-w-0">
			<video
				bind:this={video}
				class="aspect-[4/3] h-auto w-full rounded-lg border border-border bg-card-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-primary"
				width="960"
				height="720"
				controls
				playsinline
				preload="none"
				poster={nearby ? `${source}.webp` : undefined}
				aria-label={tutorial.title}
				aria-describedby={`${topic}-steps-title`}
				onerror={() => (failed = true)}
				onloadeddata={() => {
					failedSources.clear();
					failed = false;
				}}
			>
				<source
					src={`${source}.mp4`}
					type="video/mp4"
					onerror={() => sourceFailed('mp4')}
				/>
				<source
					src={`${source}.webm`}
					type="video/webm"
					onerror={() => sourceFailed('webm')}
				/>
				<track
					src={`${source}.vtt`}
					kind="captions"
					srclang={language}
					label={copy.captions}
				/>
				{copy.unavailable}
			</video>
			{#if failed}
				<p
					role="status"
					class="mt-3 text-sm leading-relaxed text-content-secondary"
				>
					{copy.unavailable}
				</p>
			{/if}
		</div>
		<div class="min-w-0">
			<h4
				id={`${topic}-steps-title`}
				class="text-sm font-semibold text-content-primary"
			>
				{copy.transcript}
			</h4>
			<ol
				class="tutorial-steps mt-3 list-decimal space-y-3 ps-5 text-sm leading-relaxed text-content-secondary marker:text-accent-primary"
			>
				{#each tutorial.steps as step}
					<li class="ps-1">
						<strong class="font-medium text-content-primary"
							>{step.title}.</strong
						>
						{step.text}
					</li>
				{/each}
			</ol>
		</div>
	</div>
</article>
