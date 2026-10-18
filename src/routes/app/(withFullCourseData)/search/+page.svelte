<script lang="ts">
	import { getContext } from 'svelte';
	import {
		searchNavigationContext,
		type SearchNavigation
	} from '$lib/searchNavigation.svelte';
	const navigation = getContext<SearchNavigation>(searchNavigationContext);
	import { goto } from '$app/navigation';
	import { PERSONAL_PLAN_READY } from '$lib/pwa/plan-visibility';
	const personalPlanReady =
		getContext<() => boolean>(PERSONAL_PLAN_READY) ?? (() => false);
	const showPersonalPlan = $derived(personalPlanReady());

	import { content, user } from '$lib/stores.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SearchFilters from '$lib/components/SearchFilters.svelte';
	import {
		normalizeSearchQuery,
		getSearchOptions,
		readSearchFilters,
		searchCourses,
		matchesSearchFilters
	} from '$lib/search';

	const { data: pageData } = $props();
	const { fullCourseData } = $derived(pageData);

	const query = $derived(
		normalizeSearchQuery(navigation.url.searchParams.get('q') ?? '')
	);
	const searchData = $derived(
		fullCourseData.then((courses: FullCourse[]) => ({
			courses,
			...getSearchOptions(courses)
		}))
	);
	function getCourseSemester(course: Course): number | undefined {
		const index = user.d.semesters.findIndex((s) => s.includes(course.code));

		if (index === -1) {
			return undefined;
		} else {
			return index;
		}
	}

	const seasonEmojis = ['❄️', '🌿', '☀️'];

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}
</script>

<div class="ui-page search-page text-content-primary">
	{#await searchData}
		<div role="status" class="flex items-center gap-2 text-content-secondary">
			<div class="h-5 w-5"><Spinner /></div>
			{content.lang.common.loading}
		</div>
	{:then { courses, faculties, maxPoints }}
		{@const filters = readSearchFilters(navigation.url.searchParams, maxPoints)}
		{@const results = searchCourses(courses, query)}
		{@const filteredResults = results.filter((course) =>
			matchesSearchFilters(course, filters, maxPoints)
		)}
		{#key navigation.externalRevision}
			<SearchFilters
				{filters}
				{faculties}
				{maxPoints}
				onchange={(next) => navigation.updateFilters(next, maxPoints)}
				onclear={() => navigation.updateFilters(undefined, maxPoints)}
			/>
		{/key}
		<header class="search-toolbar">
			<div class="search-heading">
				<h1 class="search-title">
					<span class="search-title-label"
						>{content.lang.search.resultsFor}</span
					> <bdi>“{query}”</bdi>
				</h1>
				<p role="status" class="search-count">
					{filteredResults.length}
					{content.lang.search.resultsFound}
					{#if filteredResults.length !== results.length}
						({content.lang.search.of} {results.length})
					{/if}
				</p>
			</div>
		</header>
		{#if filteredResults.length === 0}
			<p class="search-empty text-content-secondary">
				{content.lang.lang === 'he' ? 'אין תוצאות' : 'No results'}
			</p>
		{/if}
		<ul class="search-results" aria-label={content.lang.search.resultsFor}>
			{#each filteredResults as course (course.code)}
				<li id={course.code} class="min-w-0">
					<button
						class="search-result text-start"
						class:opacity-60={!course.current}
						onclick={() => goto(`/app/course/${course.code}`)}
					>
						<CourseElement code={course.code} {course} squeeze>
							{#snippet note()}
								{#if showPersonalPlan}
									{@const index = getCourseSemester(course)}
									{#if index !== undefined}
										<span>
											{seasonEmojis[index % 3]}
											<span class="hidden sm:inline">
												{content.lang.common.seasons[index % 3]}
												{Math.floor(index / 3) + 1}
											</span>
										</span>
									{:else if user.d.exemptions.includes(course.code)}
										<span>✓</span>
										<span class="hidden sm:inline">
											{content.lang.catalog.exempt}
										</span>
									{:else if user.d.wishlist.includes(course.code)}
										<span>🌟</span>
										<span class="hidden sm:inline">
											{formatName(content.lang.catalog.wishlist)}
										</span>
									{/if}
								{/if}
							{/snippet}
						</CourseElement>
					</button>
				</li>
			{/each}
		</ul>
	{:catch}
		<p role="alert" class="ui-notice">{content.lang.search.loadError}</p>
	{/await}
</div>

<style>
	.search-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 0.75rem;
		margin-block-end: 0.5rem;
	}
	.search-heading {
		display: flex;
		flex: 1;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.125rem 0.75rem;
		min-inline-size: 0;
	}
	.search-title {
		min-inline-size: 0;
		overflow-wrap: anywhere;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.4;
	}
	.search-count {
		color: rgb(var(--color-content-secondary));
		font-size: 0.75rem;
	}
	.search-empty {
		padding-block: 0.5rem;
		font-size: 0.875rem;
	}
	.search-results {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.search-result {
		display: block;
		block-size: 100%;
		border-radius: var(--radius-card);
	}
	@media (max-width: 35rem) {
		.search-title-label {
			position: absolute;
			inline-size: 1px;
			block-size: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
		.search-results {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: 0.375rem;
		}
		.search-result,
		.search-results :global(.course-card),
		.search-results :global(.course-width) {
			inline-size: 100%;
			min-inline-size: 0;
			max-inline-size: none;
		}
		.search-results :global(.course-body) {
			min-block-size: 0;
		}
	}
</style>
