<script lang="ts">
	import { generateCourseColor } from '$lib/colors';
	import CourseWidth from './CourseWidth.svelte';
	import StudyDaysComponent from './StudyDaysComponent.svelte';

	export let index: number;
	export let isCurrent: boolean;
	export let courses: Promise<Course>[];

	function getAvgMedian(courses: Course[]): number {
		const medians: number[] = courses
			.map((c) => c.median)
			.filter((m) => m !== undefined);

		return medians.length > 0
			? Math.round((medians.reduce((a, b) => a + b) / medians.length) * 10) / 10
			: 0;
	}

	function getStudyDays(
		courses: Course[],
		test: 0 | 1
	):
		| undefined
		| {
				first: [Course, Date];
				next: [Course, number][];
		  } {
		function testToDate(test: Test): Date {
			return new Date(Date.UTC(test.year, test.monthIndex, test.day));
		}

		const courseTests = courses
			.map<[Course, Date | undefined]>((c) => {
				const t0 = c.tests?.[0];
				const t1 = c.tests?.[1];

				if (t0 === undefined || t1 === undefined) {
					if (test === 0 && t0 !== undefined) {
						return [c, testToDate(t0)];
					} else {
						return [c, undefined];
					}
				}

				const d0 = testToDate(t0);
				const d1 = testToDate(t1);

				if (test === 0) {
					return [c, d0 < d1 ? d0 : d1];
				} else {
					return [c, d0 < d1 ? d1 : d0];
				}
			})

			.filter<[Course, Date]>(
				// @ts-expect-error
				([_, t]) => t !== undefined
			)
			.toSorted((a, b) => a[1].getTime() - b[1].getTime());

		const first = courseTests[0];
		let prevDate = courseTests.shift()?.[1];
		if (prevDate === undefined) {
			return undefined;
		}

		let courseStudyDays: [Course, number][] = [];

		// get total count of days between tests
		// taking into account days, weeks, years
		for (const [course, test] of courseTests) {
			const diff = test.getTime() - prevDate.getTime();
			const days = Math.floor(diff / (1000 * 60 * 60 * 24));

			courseStudyDays.push([course, days]);

			prevDate = test;
		}

		return {
			first,
			next: courseStudyDays
		};
	}
</script>

<CourseWidth>
	<div class="flex w-full flex-col items-baseline justify-between sm:flex-row">
		<div class="items-baseline justify-between">
			{#if isCurrent}
				<h1
					class="border-b-2 border-b-accent-primary text-2xl font-medium text-content-primary"
				>
					{['Winter', 'Spring', 'Summer'][index % 3]}
					{Math.floor(index / 3) + 1}
				</h1>
			{:else}
				<h1
					class="border-b-2 border-b-transparent text-2xl font-medium text-content-primary"
				>
					{['Winter', 'Spring', 'Summer'][index % 3]}
					{Math.floor(index / 3) + 1}
				</h1>
			{/if}
		</div>
		<div
			class="flex flex-row items-baseline justify-end space-x-1 text-content-secondary"
		>
			{#await Promise.all(courses) then data}
				<span>
					{data
						.map((c) => c.tests)
						.filter((t) => t !== undefined && t.length > 0).length}
				</span>
				<span>
					{getAvgMedian(data)}
				</span>
				<span>
					{data.reduce((a, b) => a + (b.points ?? 0), 0)}
				</span>
			{/await}
		</div>
	</div>

	{#if isCurrent}
		{#await Promise.all(courses) then courses}
			<div class="mt-2">
				<StudyDaysComponent semester={courses} />
			</div>
		{/await}
	{/if}

	<div class="mt-2 flex flex-col space-y-2">
		{#each courses as course, index}
			{#await course then course}
				<slot name="course" {course} {index} />
			{/await}
		{/each}
	</div>
</CourseWidth>
