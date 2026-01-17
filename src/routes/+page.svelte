<script lang="ts">
	import { goto } from '$app/navigation';
	import { content } from '$lib/stores.svelte';

	import settingsPic from '$lib/assets/settings-pic.webp?enhanced';
	import planPic from '$lib/assets/plan-pic.webp?enhanced';
	import catalogPic from '$lib/assets/catalog-pic.webp?enhanced';
	import semesterPic from '$lib/assets/semester-pic.webp?enhanced';
	import coursePic from '$lib/assets/course-pic.webp?enhanced';
	import sharePic from '$lib/assets/share-pic.webp?enhanced';
	import searchPic from '$lib/assets/search-pic.webp?enhanced';

	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import CourseExplanation from '$lib/components/CourseExplanation.svelte';
	import ImgDemo from './components/ImgDemo.svelte';
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
		<div class="w-full sm:flex sm:max-w-[1024px] sm:flex-row">
			<div
				class="w-full flex-grow pe-12 ps-12 sm:me-4 lg:pb-14 lg:pe-28 lg:ps-28"
			>
				<CourseExplanation class="h-full w-full" />
			</div>
			<div class="me-3 mt-2 sm:min-w-[300px] sm:max-w-[300px] sm:flex-grow">
				<h2 class="ms-3 text-2xl font-medium text-content-primary sm:ms-0">
					{content.lang.common.course}
				</h2>
				<p class="ms-3 text-wrap break-words text-content-secondary sm:ms-0">
					{content.lang.landing.courseCard}
				</p>
			</div>
		</div>

		<ImgDemo src={planPic} title={content.lang.header.plan}>
			{content.lang.landing.plan.header}
			<br />
			<br />
			{content.lang.landing.plan.testSchedule}
		</ImgDemo>

		<ImgDemo src={catalogPic} title={content.lang.header.catalog}>
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
		</ImgDemo>

		<ImgDemo src={settingsPic} title={content.lang.landing.settings.header}>
			{content.lang.landing.settings.description}
		</ImgDemo>

		<ImgDemo src={coursePic} title={content.lang.common.course}>
			{content.lang.landing.course}
		</ImgDemo>

		<ImgDemo src={semesterPic} title={content.lang.common.semester}>
			{content.lang.landing.semester}
		</ImgDemo>

		<ImgDemo src={sharePic} title={content.lang.landing.share.title}>
			{content.lang.landing.share.description}
		</ImgDemo>

		<ImgDemo src={searchPic} title={content.lang.header.searchPlaceholder}>
			{content.lang.landing.search}
		</ImgDemo>
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
