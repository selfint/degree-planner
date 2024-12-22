<script lang="ts">
	import { goto } from '$app/navigation';
	import { content } from '$lib/stores.svelte';

	import settings from '$lib/assets/gifs/settings-video.mp4';
	import plan from '$lib/assets/gifs/plan-video.mp4';
	import catalog from '$lib/assets/gifs/catalog-video.mp4';
	import semester from '$lib/assets/gifs/semester-video.mp4';
	import course from '$lib/assets/gifs/course-video.mp4';
	import share from '$lib/assets/gifs/share-video.mp4';
	import search from '$lib/assets/gifs/search-video.mp4';

	import Button from '$lib/components/Button.svelte';

	import Demo from './components/Demo.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
</script>

<div dir={content.lang.dir} class="circle flex flex-grow flex-col items-center">
	<div
		class="flex h-fit flex-col items-start justify-center p-3 sm:max-w-[1024px] lg:mt-20 lg:flex-row"
	>
		<h1
			class="mb-6 text-5xl text-content-primary md:text-6xl lg:me-20 lg:text-7xl"
		>
			<span class="text-nowrap">{content.lang.landing.catchphrase[0]}</span>
			<br class="hidden lg:block" />
			<span
				class="bg-gradient-to-b from-white from-30% to-accent-primary bg-clip-text text-transparent"
			>
				{content.lang.landing.catchphrase[1]}
			</span>
		</h1>

		<div class="lg:w-[520px]">
			<p class="mb-6 text-lg font-medium text-content-secondary">
				{content.lang.landing.howItWorks.join('\n')}
			</p>

			<div class="h-9">
				<AsyncButton
					variant="primary"
					onclick={async () => await goto('/settings')}
				>
					{content.lang.common.getStarted}
				</AsyncButton>
			</div>
		</div>
	</div>

	<div
		class="mt-8 flex flex-col items-center gap-y-12 p-3 sm:mt-20 sm:max-w-[1024px]"
	>
		<Demo src={plan} title={content.lang.header.plan}>
			{content.lang.landing.plan.header}
			<br />
			<br />
			{content.lang.landing.plan.testSchedule}
		</Demo>

		<Demo src={catalog} title={content.lang.header.catalog}>
			{content.lang.landing.catalog.header}
			<span class="text-nowrap rounded-md bg-card-primary p-1">
				<span class="text-accent-primary">
					{content.lang.landing.catalog.done}
				</span>
				/ {content.lang.landing.catalog.planned}
				/ {content.lang.landing.catalog.total}
			</span>.
			<br />
			<br />
			{content.lang.landing.catalog.footer}
		</Demo>

		<Demo src={settings} title={content.lang.landing.settings.header}>
			{content.lang.landing.settings.description}
		</Demo>

		<Demo src={course} title={content.lang.common.course}>
			{content.lang.landing.course}
		</Demo>

		<Demo src={semester} title={content.lang.common.semester}>
			{content.lang.landing.semester}
		</Demo>

		<Demo src={share} title={content.lang.landing.share.title}>
			{content.lang.landing.share.description}
		</Demo>

		<Demo src={search} title={content.lang.header.searchPlaceholder}>
			{content.lang.landing.search}
		</Demo>
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
