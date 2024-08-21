<script lang="ts">
	import { page } from '$app/stores';

	import { goto } from '$app/navigation';

	import { degreeData } from '$lib/stores';

	import CourseElement from '$lib/components/CourseElement.svelte';

	import { getCourseLists } from '$lib/requirements';
	import { getAllCourses, getCourseData } from '$lib/courseData';

	$: query = $page.url.searchParams.get('q') ?? '';

	const data = getAllCourses();
	const corpus: Promise<[string, Course][]> = data.then((courses) =>
		courses.map((course) => [(course.name ?? '') + course.code, course])
	);

	$: searchResults = corpus
		.then((corpus) => {
			return corpus
				.filter(([name, _]) => name.includes(query))
				.map(([_, course]) => course)
				.toSorted((a, b) => {
					return (b.median ?? 0) - (a.median ?? 0);
				});
		})
		// try direct lookup - maybe course is missing
		.then((results) => {
			if (results.length === 0) {
				return getCourseData(query).then((c) => [c]);
			} else {
				return results;
			}
		});
</script>

<div class="m-3 text-content-primary">
	{#await searchResults}
		<p>Loading...</p>
	{:then results}
		<h1 class="text-2xl">
			Results for "{query}"
		</h1>
		<p class="mb-3 text-base text-content-secondary">
			{results.length} results found
		</p>
		<ul class="flex flex-row flex-wrap">
			{#each results as course, i}
				<li class="pb-4 pr-2">
					<div
						class="container"
						on:mousedown={() => goto(`/course/${course.code}`)}
						role="button"
						tabindex={i}
					>
						<CourseElement
							{course}
							requirements={$degreeData?.then((d) =>
								getCourseLists(d.requirements, course.code)
							)}
						/>
					</div>
				</li>
			{/each}
		</ul>
	{:catch error}
		<p>Error: {error.message}</p>
	{/await}
</div>
