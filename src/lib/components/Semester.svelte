<script lang="ts">
	import CourseWidth from './CourseWidth.svelte';
	import StudyDaysComponent from './StudyDaysComponent.svelte';

	export let index: number;
	export let isCurrent: boolean;
	export let courses: Course[];

	function getAvgMedian(courses: Course[]): number {
		const medians: number[] = courses
			.map((c) => c.median)
			.filter((m) => m !== undefined);

		return medians.length > 0
			? Math.round((medians.reduce((a, b) => a + b) / medians.length) * 10) / 10
			: 0;
	}
</script>

<CourseWidth>
	<div class="flex w-full flex-col items-baseline justify-between sm:flex-row">
		<div class="items-baseline justify-between">
			{#if isCurrent}
				<h1
					class="border-b-2 border-b-accent-primary text-lg font-medium text-content-primary"
				>
					{['Winter', 'Spring', 'Summer'][index % 3]}
					{Math.floor(index / 3) + 1}
				</h1>
			{:else}
				<h1
					class="border-b-2 border-b-transparent text-lg font-medium text-content-primary"
				>
					{['Winter', 'Spring', 'Summer'][index % 3]}
					{Math.floor(index / 3) + 1}
				</h1>
			{/if}
		</div>
		<div
			class="flex flex-row items-baseline justify-end space-x-1 text-content-secondary"
		>
			<span>
				{courses
					.map((c) => c.tests)
					.filter((t) => t !== undefined && t.length > 0).length}
			</span>
			<span>
				{getAvgMedian(courses)}
			</span>
			<span>
				{courses.reduce((a, b) => a + (b.points ?? 0), 0)}
			</span>
		</div>
	</div>

	{#if isCurrent}
		<div class="mt-2">
			<StudyDaysComponent semester={courses} />
		</div>
	{/if}

	<div class="mt-2 flex flex-col space-y-2">
		{#each courses as course, index}
			<slot name="course" {course} {index} />
		{/each}
	</div>
</CourseWidth>
