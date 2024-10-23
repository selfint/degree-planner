<script lang="ts">
	import type { Snippet } from 'svelte';

	import { goto } from '$app/navigation';
	import { content } from '$lib/stores.svelte';

	import progress from '$lib/assets/gifs/progress.mp4';
	import plan from '$lib/assets/gifs/plan.mp4';
	import catalog from '$lib/assets/gifs/catalog.mp4';
	import semester from '$lib/assets/gifs/semester.mp4';
	import course from '$lib/assets/gifs/course.mp4';
	import share from '$lib/assets/gifs/share.mp4';

	import Button from '$lib/components/Button.svelte';

	import Video from './components/Video.svelte';
</script>

<div dir={content.lang.dir} class="circle flex flex-grow flex-col">
	<div
		class="m-3 flex h-fit flex-col items-start justify-center lg:mt-20 lg:flex-row"
	>
		<h1
			class="mb-6 w-fit text-5xl text-content-primary md:text-6xl lg:me-20 lg:text-7xl"
		>
			<span class="w-fit">{content.lang.landing.catchphrase[0]}</span>
			<br class="hidden lg:block" />
			<span
				class="w-fit bg-gradient-to-b from-white from-30% to-accent-primary bg-clip-text text-transparent"
			>
				{content.lang.landing.catchphrase[1]}
			</span>
		</h1>

		<div class="lg:w-[520px]">
			<p class="mb-6 text-lg font-medium text-content-secondary">
				{content.lang.landing.howItWorks.join('\n')}
			</p>

			<div class="h-9">
				<Button variant="primary" onmousedown={() => goto('/progress')}>
					{content.lang.common.getStarted}
				</Button>
			</div>
		</div>
	</div>

	{#snippet video(src: string, title: string, description: string | Snippet)}
		<div class="sm:flex sm:max-w-[1024px] sm:flex-row">
			<div class="flex-grow sm:me-4 sm:max-w-[620px]">
				<Video {src} />
			</div>
			<div class="mt-2 sm:min-w-[300px] sm:max-w-[300px] sm:flex-grow">
				<h2 class="text-2xl font-medium text-content-primary">
					{title}
				</h2>
				<p class="text-wrap break-words text-content-secondary">
					{#if typeof description === 'string'}
						{description}
					{:else}
						{@render description()}
					{/if}
				</p>
			</div>
		</div>
	{/snippet}

	<div class="mt-8 flex w-full flex-col items-center space-y-8 p-2 sm:mt-20">
		{@render video(
			progress,
			content.lang.header.progress,
			content.lang.landing.progress
		)}
		{@render video(plan, content.lang.header.plan, content.lang.landing.plan)}
		{@render video(
			catalog,
			content.lang.header.catalog,
			content.lang.landing.catalog
		)}
		{@render video(
			course,
			content.lang.common.course,
			content.lang.landing.course
		)}
		{@render video(
			semester,
			content.lang.common.semester,
			content.lang.landing.semester
		)}
		{@render video(
			share,
			content.lang.landing.shareTitle,
			content.lang.landing.share
		)}
	</div>
</div>

<style lang="postcss">
	:global([dir='ltr'] .circle) {
		background-image: radial-gradient(
			ellipse 70% 20% at 100% 15%,
			theme('colors.accent-primary') 1%,
			transparent 70%
		);
	}

	:global([dir='rtl'] .circle) {
		background-image: radial-gradient(
			ellipse 70% 20% at 0% 15%,
			theme('colors.accent-primary') 1%,
			transparent 70%
		);
	}

	@media (min-width: 640px) {
		:global([dir='ltr'] .circle) {
			background-image: radial-gradient(
				ellipse 90% 65% at 0% 50%,
				theme('colors.accent-primary') 1%,
				transparent 70%
			);
		}

		:global([dir='rtl'] .circle) {
			background-image: radial-gradient(
				ellipse 90% 65% at 100% 50%,
				theme('colors.accent-primary') 1%,
				transparent 70%
			);
		}
	}
</style>
