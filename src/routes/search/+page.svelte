<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import { degreeData } from '$lib/stores.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import { getCourseLists } from '$lib/requirements';
	import { getAllCourses } from '$lib/courseData';
	import { cms } from '$lib/content';

	const lang = cms.en;

	const query = $derived(($page.url.searchParams.get('q') ?? '').trim());
	const results = $derived(
		getAllCourses()
			.filter(({ name, code }) => name?.includes(query) || code.includes(query))
			.toSorted((a, b) => {
				return (b.median ?? 0) - (a.median ?? 0);
			})
	);

	const requirements = $derived(degreeData()?.requirements);
</script>

<div class="m-3 mr-0 text-content-primary">
	<h1 class="text-lg">
		{lang.search.resultsFor} "{query}"
	</h1>
	<p class="mb-3 text-xs text-content-secondary">
		{results.length}
		{lang.search.resultsFound}
	</p>
	<ul class="flex flex-row flex-wrap">
		{#each results as course, i}
			<li class="pb-4 pr-2">
				<div
					onmousedown={() => goto(`/course/${course.code}`)}
					role="button"
					tabindex={i}
				>
					<CourseElement
						{course}
						lists={getCourseLists(requirements, course.code)}
					/>
				</div>
			</li>
		{/each}
	</ul>
</div>
