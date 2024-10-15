<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import { user } from '$lib/stores.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import { getCourseLists, loadDegreeData } from '$lib/requirements';
	import { getAllCourses } from '$lib/courseData';

	const query = $derived(($page.url.searchParams.get('q') ?? '').trim());
	const results = $derived(
		getAllCourses()
			.filter(({ name, code }) => name?.includes(query) || code.includes(query))
			.toSorted((a, b) => {
				return (b.median ?? 0) - (a.median ?? 0);
			})
	);

	let requirements: DegreeRequirements | undefined = $state(undefined);
	$effect(() => {
		if (user.degree !== undefined) {
			loadDegreeData(user.degree).then((d) => (requirements = d.requirements));
		}
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
						lists={getCourseLists(requirements, course.code)}
					/>
				</div>
			</li>
		{/each}
	</ul>
</div>
