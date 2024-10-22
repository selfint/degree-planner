<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';

	import { content } from '$lib/stores.svelte';
	import progressDesktop from '$lib/assets/gifs/progress.mp4';

	let progressVideo: HTMLVideoElement;
</script>

<div
	class="flex flex-col bg-[radial-gradient(ellipse_120%_100%_at_bottom_right,_var(--tw-gradient-stops))] from-accent-primary from-[1%] to-transparent to-70% sm:bg-[radial-gradient(ellipse_120%_100%_at_bottom_left,_var(--tw-gradient-stops))]"
>
	<div class="m-3 flex h-fit flex-col justify-center lg:mt-32 lg:flex-row">
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
				{content.lang.landing.about}
			</p>

			<div class="h-9">
				<Button variant="primary" onmousedown={() => goto('/progress')}>
					{content.lang.common.getStarted}
				</Button>
			</div>
		</div>
	</div>

	<div
		class="mt-8 flex w-full flex-col items-center justify-center space-y-5 p-3 sm:mt-36 sm:flex-row sm:items-start sm:space-x-10 sm:space-y-0"
	>
		<div
			class="w-full rounded-lg border border-white border-opacity-30 bg-white bg-opacity-10 p-2 bg-blend-color-burn backdrop-blur sm:max-w-[720px]"
		>
			<video
				bind:this={progressVideo}
				onmouseenter={progressVideo.play}
				onmouseleave={progressVideo.pause}
				class="pointer-events-auto w-full rounded-none bg-transparent"
				playsinline
				muted
				loop
				controls
			>
				<source src={progressDesktop} type="video/mp4" />
				Your browser does not support the video tag.
			</video>
		</div>
		<div>
			<h2 class="text-content-primary">Progress</h2>
			<p class="text-content-secondary">
				{content.lang.landing.progress}
			</p>
		</div>
	</div>
</div>

<style lang="postcss">
	.circle {
		background-image: radial-gradient(
			ellipse 160% 140% at bottom left,
			theme(colors.accent-primary) 1%,
			transparent 50%
		);
	}

	/* Adjust for RTL layout */
	:global([dir='rtl'] .circle) {
		left: auto;
		right: -100px;
	}
</style>
