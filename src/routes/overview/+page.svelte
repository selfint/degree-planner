<script lang="ts">
	import {
		semesters,
		getCourseData,
		degreeData,
		currentSemester
	} from '$lib/stores';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import { getCourseLists } from '$lib/requirements';

	function getAvgMedian(courses: Course[]): number {
		// @ts-expect-error
		const medians: number[] = courses
			.map((c) => c.median)
			.filter((m) => m !== undefined);

		console.log(medians);
		return medians.length > 0
			? Math.round((medians.reduce((a, b) => a + b) / medians.length) * 10) / 10
			: 0;
	}
</script>

<div class="flex flex-row space-x-4">
	{#each $semesters as semester, i}
		<div class="w-56 space-y-2">
			<div class="flex flex-row items-baseline justify-between">
				{#if i === $currentSemester}
					<h1
						class="border-b-2 border-b-accent-primary text-2xl font-medium text-content-primary"
					>
						{['Winter', 'Spring', 'Summer'][i % 3]}
						{Math.floor(i / 3) + 1}
					</h1>
				{:else}
					<h1 class="text-2xl font-medium text-content-primary">
						{['Winter', 'Spring', 'Summer'][i % 3]}
						{Math.floor(i / 3) + 1}
					</h1>
				{/if}

				<div
					class="flex flex-row items-baseline justify-end space-x-1 text-content-secondary"
				>
					<span>
						{semester.length}
					</span>
					{#await Promise.all(semester.map(getCourseData))}
						<span>_</span>
						<span>_</span>
					{:then data}
						<span>
							{getAvgMedian(data)}
						</span>
						<span>
							{data.reduce((a, b) => a + (b.points ?? 0), 0)}
						</span>
					{/await}
				</div>
			</div>
			<div class="flex flex-col space-y-2">
				{#each semester as code}
					{#await getCourseData(code) then data}
						<CourseElement
							{code}
							{data}
							requirements={$degreeData?.then((d) =>
								getCourseLists(d.requirements, code)
							)}
						/>
					{/await}
				{/each}
			</div>
		</div>
	{/each}
</div>
