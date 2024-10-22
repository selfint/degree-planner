<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';

	import { content } from '$lib/stores.svelte';
	import progressDesktop from '$lib/assets/gifs/progress.mp4';

	let progressVideo: HTMLVideoElement;
</script>

<div dir={content.lang.dir} class="circle flex flex-grow flex-col">
	<div class="m-3 flex h-fit flex-col justify-center lg:mt-40 lg:flex-row">
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

	<div class="mt-8 flex w-full flex-col items-center space-y-8 p-3 sm:mt-32">
		<div>
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
			<div class="mt-3">
				<h2 class="text-2xl font-medium text-content-primary">
					{content.lang.header.progress}
				</h2>
				<p class="text-content-secondary">
					{content.lang.landing.progress}
				</p>
			</div>
		</div>
		<div>
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
			<div class="mt-3">
				<h2 class="text-2xl font-medium text-content-primary">
					{content.lang.header.plan}
				</h2>
				<p class="text-content-secondary">
					{content.lang.landing.progress}
				</p>
			</div>
		</div>
		<div>
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
			<div class="mt-3">
				<h2 class="text-2xl font-medium text-content-primary">
					{content.lang.header.catalog}
				</h2>
				<p class="text-content-secondary">
					{content.lang.landing.progress}
				</p>
			</div>
		</div>
		<div>
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
			<div class="mt-3">
				<h2 class="text-2xl font-medium text-content-primary">
					{content.lang.common.course}
				</h2>
				<p class="text-content-secondary">
					{content.lang.landing.progress}
				</p>
			</div>
		</div>
		<div>
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
			<div class="mt-3">
				<h2 class="text-2xl font-medium text-content-primary">
					{content.lang.common.semester}
				</h2>
				<p class="text-content-secondary">
					{content.lang.landing.progress}
				</p>
			</div>
		</div>
		<div>
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
			<div class="mt-3">
				<h2 class="text-2xl font-medium text-content-primary">
					{content.lang.landing.share}
				</h2>
				<p class="text-content-secondary">
					{content.lang.landing.progress}
				</p>
			</div>
		</div>
	</div>
</div>

<style lang="postcss">
	:global([dir='ltr'] .circle) {
		background-image: radial-gradient(
			ellipse 70% 20% at 100% 25%,
			theme('colors.accent-primary') 1%,
			transparent 70%
		);
	}

	:global([dir='rtl'] .circle) {
		background-image: radial-gradient(
			ellipse 70% 20% at 0% 25%,
			theme('colors.accent-primary') 1%,
			transparent 70%
		);
	}
</style>
