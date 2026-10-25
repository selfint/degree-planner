<script lang="ts">
	import { content } from '$lib/preferences.svelte';

	import GetStartedLink from '$lib/components/GetStartedLink.svelte';
	import FeatureVideo from './components/FeatureVideo.svelte';
	import CourseExplanation from '$lib/components/CourseExplanation.svelte';
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
	<div
		class="flex h-fit flex-col items-start justify-center p-3 sm:max-w-[1024px] lg:mt-20 lg:flex-row"
	>
		<h1
			class="mb-6 text-5xl text-content-primary md:text-6xl lg:me-20 lg:text-7xl"
		>
			<span class="sm:text-nowrap">{content.lang.landing.catchphrase[0]}</span>
			<br class="hidden lg:block" />
			<span
				class="bg-gradient-to-b from-content-primary from-30% to-accent-primary bg-clip-text text-transparent"
			>
				{content.lang.landing.catchphrase[1]}
			</span>
		</h1>

		<div class="lg:w-[520px]">
			<p class="mb-6 text-lg font-medium text-content-secondary">
				{content.lang.landing.howItWorks.join('\n')}
			</p>

			<div class="h-9">
				<GetStartedLink />
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

		<ImgDemo title={content.lang.header.plan}>
			{#snippet media()}
				<FeatureVideo topic="feature-plan" title={content.lang.header.plan} />
			{/snippet}
			{content.lang.landing.plan.header}
			<br />
			<br />
			{content.lang.landing.plan.testSchedule}
		</ImgDemo>

		<ImgDemo title={content.lang.header.catalog}>
			{#snippet media()}
				<FeatureVideo
					topic="feature-catalog"
					title={content.lang.header.catalog}
				/>
			{/snippet}
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

		<ImgDemo title={content.lang.landing.settings.header}>
			{#snippet media()}
				<FeatureVideo
					topic="feature-settings"
					title={content.lang.landing.settings.header}
				/>
			{/snippet}
			{content.lang.landing.settings.description}
		</ImgDemo>

		<ImgDemo title={content.lang.common.course}>
			{#snippet media()}
				<FeatureVideo
					topic="feature-course"
					title={content.lang.common.course}
				/>
			{/snippet}
			{content.lang.landing.course}
		</ImgDemo>

		<ImgDemo title={content.lang.common.semester}>
			{#snippet media()}
				<FeatureVideo
					topic="feature-semester"
					title={content.lang.common.semester}
				/>
			{/snippet}
			{content.lang.landing.semester}
		</ImgDemo>

		<ImgDemo title={content.lang.landing.share.title}>
			{#snippet media()}
				<FeatureVideo
					topic="feature-share"
					title={content.lang.landing.share.title}
				/>
			{/snippet}
			{content.lang.landing.share.description}
		</ImgDemo>

		<ImgDemo title={content.lang.header.searchPlaceholder}>
			{#snippet media()}
				<FeatureVideo
					topic="feature-search"
					title={content.lang.header.searchPlaceholder}
				/>
			{/snippet}
			{content.lang.landing.search}
		</ImgDemo>
	</div>
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
