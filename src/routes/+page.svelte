<script lang="ts">
	import { content } from '$lib/preferences.svelte';

	import settingsPic from '$lib/assets/settings-pic.webp?enhanced';
	import planPic from '$lib/assets/plan-pic.webp?enhanced';
	import catalogPic from '$lib/assets/catalog-pic.webp?enhanced';
	import semesterPic from '$lib/assets/semester-pic.webp?enhanced';
	import coursePic from '$lib/assets/course-pic.webp?enhanced';
	import sharePic from '$lib/assets/share-pic.webp?enhanced';
	import searchPic from '$lib/assets/search-pic.webp?enhanced';

	import LandingInstallInfo from '$lib/components/LandingInstallInfo.svelte';
	import GetStartedLink from '$lib/components/GetStartedLink.svelte';
	import Tutorials from './components/Tutorials.svelte';
	import ImgDemo from './components/ImgDemo.svelte';
	import { landingParallax } from './components/landingParallax';
</script>

<div
	dir={content.lang.dir}
	class="landing flex flex-grow flex-col items-center"
>
	<div class="landing-background" aria-hidden="true">
		<div class="landing-gradient" use:landingParallax></div>
	</div>
	<section
		class="grid w-full max-w-[64rem] gap-8 px-5 pb-12 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-14 lg:pb-16 lg:pt-20"
		aria-labelledby="landing-title"
	>
		<div class="min-w-0">
			<h1
				id="landing-title"
				class="text-[clamp(2.75rem,5vw,4.25rem)] font-semibold leading-[1.15] tracking-tight text-content-primary"
			>
				<span class="block">{content.lang.landing.catchphrase[0]}</span>
				<span
					class="block bg-gradient-to-b from-content-primary from-20% to-accent-primary bg-clip-text text-transparent"
				>
					{content.lang.landing.catchphrase[1]}
				</span>
			</h1>
			<div class="mt-7">
				<GetStartedLink />
			</div>
		</div>

		<ol
			class="min-w-0 list-decimal space-y-3 ps-5 text-base leading-relaxed text-content-secondary marker:font-semibold marker:text-accent-primary lg:border-s lg:border-border lg:ps-9"
		>
			{#each content.lang.landing.howItWorks as step}
				<li class="ps-2">{step}</li>
			{/each}
		</ol>
	</section>

	<div
		class="flex w-full max-w-[64rem] flex-col gap-y-14 px-5 pb-14 sm:gap-y-20 sm:px-6 sm:pb-20"
	>
		<Tutorials />

		<ImgDemo src={planPic} title={content.lang.header.plan}>
			{content.lang.landing.plan.header}
			<br />
			<br />
			{content.lang.landing.plan.testSchedule}
		</ImgDemo>

		<ImgDemo src={catalogPic} title={content.lang.header.catalog}>
			{content.lang.landing.catalog.header}
			<span class="inline rounded-md bg-card-primary px-1.5 py-0.5">
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
	<LandingInstallInfo />
</div>

<style lang="postcss">
	.landing {
		position: relative;
		isolation: isolate;
	}

	.landing-background {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
	}

	.landing-gradient {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(
			ellipse 70% 20% at 100% 15%,
			rgb(var(--landing-glow)) 1%,
			transparent 70%
		);
	}

	.landing[dir='rtl'] .landing-gradient {
		background-image: radial-gradient(
			ellipse 70% 20% at 0% 15%,
			rgb(var(--landing-glow)) 1%,
			transparent 70%
		);
	}

	@media (min-width: 40rem) {
		.landing-gradient {
			background-image: radial-gradient(
				ellipse 90% 65% at 0% 50%,
				rgb(var(--landing-glow)) 1%,
				transparent 70%
			);
		}

		.landing[dir='rtl'] .landing-gradient {
			background-image: radial-gradient(
				ellipse 90% 65% at 100% 50%,
				rgb(var(--landing-glow)) 1%,
				transparent 70%
			);
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.landing-gradient:global([data-parallax='fallback']) {
			transform: translate3d(0, var(--landing-parallax-offset, 0rem), 0);
			will-change: transform;
		}

		.landing-gradient:global([data-parallax='native']) {
			animation: landing-parallax 1s linear both;
			/* Explicit root: the clipping wrapper must not become the timeline. */
			animation-timeline: scroll(root y);
		}
	}

	@keyframes landing-parallax {
		from {
			transform: translate3d(0, 0, 0);
		}
		to {
			transform: translate3d(0, var(--landing-parallax-travel, 0rem), 0);
		}
	}
</style>
