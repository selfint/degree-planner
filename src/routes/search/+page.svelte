<script lang="ts">
	import { page } from '$app/stores';

	import { degreeData } from '$lib/stores';

	import CourseElement from '$lib/components/CourseElement.svelte';

	import { getCourseLists } from '$lib/requirements';
	import { getAllCourses } from '$lib/courseData';

	$: query = $page.url.searchParams.get('q') ?? '';

	const data = getAllCourses();
	const corpus: Promise<[string, Course][]> = data.then((courses) =>
		courses.map((course) => [course.name ?? course.code, course])
	);

	$: searchResults = corpus.then((corpus) => {
		return corpus
			.filter(([name, course]) => name.includes(query))
			.map((a) => a[1])
			.toSorted((a, b) => {
				return (b.median ?? 0) - (a.median ?? 0);
			});
	});
</script>

<div class="text-content-primary">
	{#await searchResults}
		<p>Loading...</p>
	{:then results}
		{#if results.length === 0}
			<p>No results found</p>
		{:else}
			<ul class="flex flex-row flex-wrap">
				{#each results as course}
					<li class="pb-2 pl-1 pr-1 pt-2">
						<CourseElement
							{course}
							requirements={$degreeData?.then((d) =>
								getCourseLists(d.requirements, course.code)
							)}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	{:catch error}
		<p>Error: {error.message}</p>
	{/await}
</div>
