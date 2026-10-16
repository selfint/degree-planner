<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	import { content, user } from '$lib/stores.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SearchFilters from '$lib/components/SearchFilters.svelte';
	import {
		normalizeSearchQuery,
		getSearchOptions,
		readSearchFilters,
		writeSearchFilters,
		searchFilterKeys,
		searchCourses,
		matchesSearchFilters,
		type SearchFilters as SearchFiltersState
	} from '$lib/search';

	const { data: pageData } = $props();
	const { fullCourseData } = $derived(pageData);

	const query = $derived(
		normalizeSearchQuery(page.url.searchParams.get('q') ?? '')
	);
	const searchData = $derived(
		fullCourseData.then((courses: FullCourse[]) => ({
			courses,
			...getSearchOptions(courses)
		}))
	);
	let pending = $state(false);

	async function updateFilters(
		filters: SearchFiltersState | undefined,
		maxPoints: number
	) {
		if (pending) return;
		const url = new URL(page.url);
		if (filters) {
			writeSearchFilters(url.searchParams, filters, maxPoints);
		} else {
			searchFilterKeys.forEach((key) => url.searchParams.delete(key));
		}
		if (url.href === page.url.href) return;
		pending = true;
		try {
			await goto(url, { noScroll: true, keepFocus: true });
		} finally {
			pending = false;
		}
	}

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
		{@const filters = readSearchFilters(page.url.searchParams, maxPoints)}
		{@const results = searchCourses(courses, query)}
		{@const filteredResults = results.filter((course) =>
			matchesSearchFilters(course, filters, maxPoints)
		)}
		<SearchFilters
			{filters}
			{faculties}
			{maxPoints}
			{pending}
			onchange={(next) => updateFilters(next, maxPoints)}
			onclear={() => updateFilters(undefined, maxPoints)}
		/>
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
						onclick={() => goto(`/course/${course.code}`)}
					>
						<CourseElement code={course.code} {course}>
							{#snippet note()}
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
