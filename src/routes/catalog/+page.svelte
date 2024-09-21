<script lang="ts">
	import { goto } from '$app/navigation';

	import CourseRow from './components/CourseRow.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';

	import { degreeData, wishlist, semesters } from '$lib/stores';
	import {
		getDegreeRequirementCourses,
		getCourseLists
	} from '$lib/requirements';
	import { getAllCoursesSync, getCourseData } from '$lib/courseData';
	import { bm25 } from '$lib/bm25';

	$: lists =
		$degreeData?.then((d) => getDegreeRequirementCourses(d.requirements)) ?? [];

	$: recommendations =
		$degreeData?.then(async (d) => {
			const courses = getAllCoursesSync();

			const nonRecommendedCourses = await Promise.all(
				$semesters
					.flat()
					.filter((c) => !d.recommended.flat().includes(c))
					.map(async (c) => await getCourseData(c))
			);

			const queries = nonRecommendedCourses
				.filter((c) => c.name !== undefined && (c.about?.length ?? 0) > 10)
				.map((c) => ({
					course: c,
					query: c.name + ' ' + c.about
				}))
				.toSorted(() => Math.random() - 0.5)
				.slice(0, 5);

			const corpusCourses = (await courses)
				.filter((c) => c.name !== undefined && (c.about?.length ?? 0) > 10)
				.filter((c) => !$semesters.flat().includes(c.code));

			const corpus = corpusCourses.map((c) => c.name + ' ' + c.about);

			return queries
				.map(({ course, query }) => ({
					course,
					hits: bm25(query, corpus).slice(0, 30)
				}))
				.map(({ course, hits }) => ({
					course,
					hits: hits.map(({ index }) => corpusCourses[index])
				}));
		}) ?? Promise.resolve([]);
</script>

<div class="m-3 mr-0">
	<CourseRow colorize={false} titles={['Wish list']} codes={$wishlist} />
	{#await lists}
		<div class="text-content-secondary">Loading...</div>
	{:then lists}
		{#each lists as list}
			{#if list.courses.length > 0}
				<CourseRow titles={list.path} codes={list.courses} />
			{/if}
		{/each}
	{/await}

	{#await recommendations then recommendations}
		{#each recommendations as { course, hits }, i}
			<div class="mb-4 min-h-[118px] max-w-full">
				<h1
					class="mb-2 flex flex-row items-baseline space-x-4 text-2xl font-medium text-content-primary"
				>
					<div class="flex flex-row items-baseline space-x-2">
						<span class="w-fit pr-2"> More like {course.name} </span>
					</div>
				</h1>
				<div class="mb-4 flex w-full flex-row space-x-2 overflow-x-auto">
					{#each hits as course, i}
						<div
							class="container w-fit"
							tabindex={i}
							role="button"
							on:click={() => goto(`/course/${course.code}`)}
							on:keydown={(e) => {
								if (e.key === 'Enter') {
									goto(`/course/${course.code}`);
								}
							}}
						>
							<CourseElement
								{course}
								lists={$degreeData?.then((d) =>
									getCourseLists(d.requirements, course.code)
								)}
							/>
						</div>
					{/each}
				</div>
			</div>
		{/each}
		<div class="mb-4 flex w-full flex-row space-x-2 overflow-x-auto"></div>
	{/await}
</div>
