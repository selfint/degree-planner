<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import { degreeData } from '$lib/stores';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import { getCourseLists } from '$lib/requirements';
	import { getCourseEntries } from '$lib/courseData';

	$: query = ($page.url.searchParams.get('q') ?? '').trim();

	const corpus: [string, Course][] = getCourseEntries();

	function search(query: string): Course[] {
		return corpus
			.filter(([name, _]) => name.includes(query))
			.map(([_, course]) => course)
			.toSorted((a, b) => {
				return (b.median ?? 0) - (a.median ?? 0);
			});
	}

	$: results = search(query);
</script>

<div class="m-3 mr-0 text-content-primary">
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
						lists={$degreeData?.then((d) =>
							getCourseLists(d.requirements, course.code)
						)}
					/>
				</div>
			</li>
		{/each}
	</ul>
</div>
