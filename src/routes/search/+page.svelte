<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import { user } from '$lib/stores.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import { getCourseLists, loadDegreeData } from '$lib/requirements';
	import { getAllCourses } from '$lib/courseData';

	const query = $derived(($page.url.searchParams.get('q') ?? '').trim());
	const corpus = getAllCourses();
	const results = $derived(
		corpus
			.filter(({ name, code }) => name?.includes(query) || code.includes(query))
			.toSorted((a, b) => {
				return (b.median ?? 0) - (a.median ?? 0);
			})
	);

	const degreeRequirements = $derived.by(() => {
		if (user.degree === undefined) {
			return undefined;
		}

		const data = loadDegreeData(user.degree);
		return data.then((d) => d.requirements);
	});
</script>

<div class="m-3 mr-0 text-content-primary">
	<h1 class="text-lg">
		Results for "{query}"
	</h1>
	<p class="mb-3 text-xs text-content-secondary">
		{results.length} results found
	</p>
	<ul class="flex flex-row flex-wrap">
		{#each results as course, i}
			<li class="pb-4 pr-2">
				<div
					class="container"
					onmousedown={() => goto(`/course/${course.code}`)}
					role="button"
					tabindex={i}
				>
					<CourseElement
						{course}
						lists={degreeRequirements?.then((r) =>
							getCourseLists(r, course.code)
						)}
					/>
				</div>
			</li>
		{/each}
	</ul>
</div>
