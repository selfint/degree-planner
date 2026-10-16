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

<div class="m-3 text-content-primary">
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
		<h1 class="text-lg">{content.lang.search.resultsFor} "{query}"</h1>
		<p role="status" class="mb-3 text-base text-content-secondary">
			{filteredResults.length}
			{content.lang.search.resultsFound}
			{#if filteredResults.length !== results.length}
				({content.lang.search.of} {results.length})
			{/if}
		</p>
		{#if filteredResults.length === 0}
			<p class="text-content-secondary">{content.lang.search.noResults}</p>
		{/if}
		<ul
			class="flex flex-row flex-wrap"
			aria-label={content.lang.search.resultsFor}
		>
			{#each filteredResults as course (course.code)}
				<li id={course.code} class="pb-4 pe-2">
					<button
						class:opacity-60={!course.current}
						onclick={() => goto(`/app/course/${course.code}`)}
					>
						<CourseElement code={course.code} {course}>
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
		<p role="alert">{content.lang.search.loadError}</p>
	{/await}
</div>
