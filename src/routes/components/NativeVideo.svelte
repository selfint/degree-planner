<script lang="ts">
	import { onMount } from 'svelte';

	let {
		source,
		title,
		language,
		captions,
		unavailable
	}: {
		source: string;
		title: string;
		language: 'en' | 'he';
		captions: string;
		unavailable: string;
	} = $props();
	let video: HTMLVideoElement;
	let nearby = $state(false);
	let failed = $state(false);
	const failedSources = new Set<string>();

	function sourceFailed(format: string) {
		failedSources.add(format);
		if (failedSources.size === 2) failed = true;
	}

	onMount(() => {
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

<video
	bind:this={video}
	class="aspect-[4/3] h-auto w-full rounded-lg bg-card-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-primary"
	width="960"
	height="720"
	controls
	playsinline
	preload="none"
	poster={nearby ? `${source}.webp` : undefined}
	aria-label={title}
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
		label={captions}
	/>
	{unavailable}
</video>
{#if failed}
	<p role="status" class="mt-3 text-sm leading-relaxed text-content-secondary">
		{unavailable}
	</p>
{/if}
