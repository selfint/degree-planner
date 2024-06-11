<script lang="ts">
	import {
		semesters,
		degreeData,
		currentSemester,
		wishlist
	} from '$lib/stores';

	import { getCourseData } from '$lib/courseData';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import { getCourseLists } from '$lib/requirements';
	import { generateCourseColor } from '$lib/colors';
	import { goto } from '$app/navigation';

	function getAvgMedian(courses: Course[]): number {
		// @ts-expect-error
		const medians: number[] = courses
			.map((c) => c.median)
			.filter((m) => m !== undefined);

		return medians.length > 0
			? Math.round((medians.reduce((a, b) => a + b) / medians.length) * 10) / 10
			: 0;
	}

	function getStudyDays(courses: Course[], test: 0 | 1): [Course, number][] {
		// TODO: get semester end date and use it to calculate
		// the study days for the first test
		const fakeFirstStudyDays = 7;

		const courseTests = courses
			.map<[Course, Test | undefined]>(
				(c) => [c, c.tests?.[test]] as [Course, Test | undefined]
			)

			.filter<[Course, Test]>(
				// @ts-expect-error
				([_, t]) => t !== undefined
			)
			.map<[Course, Date]>(([c, t]) => [
				c,
				new Date(Date.UTC(t.year, t.monthIndex, t.day))
			])
			.toSorted((a, b) => a[1].getTime() - b[1].getTime());

		const firstCourse = courseTests[0]?.[0];
		let prevDate = courseTests.shift()?.[1];
		if (prevDate === undefined) {
			return [];
		}

		let courseStudyDays: [Course, number][] = [
			[firstCourse, fakeFirstStudyDays]
		];

		// get total count of days between tests
		// taking into account days, weeks, years
		for (const [course, test] of courseTests) {
			const diff = test.getTime() - prevDate.getTime();
			const days = Math.floor(diff / (1000 * 60 * 60 * 24));

			courseStudyDays.push([course, days]);

			prevDate = test;
		}

		return courseStudyDays;
	}
</script>

<h1 class="mb-2 text-2xl font-medium text-content-primary">Wish list</h1>
<div class="mb-4 flex flex-row space-x-2">
	{#await Promise.all($wishlist.map(getCourseData))}
		<div class="text-content-secondary">Loading...</div>
	{:then courses}
		{#each courses as course, i}
			<div
				class="container"
				tabindex={i}
				role="button"
				on:mousedown={() => goto(`/course/${course.code}`)}
			>
				<CourseElement
					{course}
					requirements={$degreeData?.then((d) =>
						getCourseLists(d.requirements, course.code)
					)}
				/>
			</div>
		{/each}
	{/await}
</div>
<div class="flex flex-row space-x-4">
	{#each $semesters as semester, i}
		<div class="w-56 min-w-56 max-w-56 space-y-2">
			<div class="flex min-w-full flex-row items-baseline justify-between">
				{#if i === $currentSemester}
					<h1
						class="border-b-2 border-b-accent-primary text-2xl font-medium text-content-primary"
					>
						{['Winter', 'Spring', 'Summer'][i % 3]}
						{Math.floor(i / 3) + 1}
					</h1>
				{:else}
					<h1
						class="border-b-2 border-b-transparent text-2xl font-medium text-content-primary"
					>
						{['Winter', 'Spring', 'Summer'][i % 3]}
						{Math.floor(i / 3) + 1}
					</h1>
				{/if}

				<div
					class="flex flex-row items-baseline justify-end space-x-1 text-content-secondary"
				>
					{#await Promise.all(semester.map(getCourseData))}
						<span>_</span>
						<span>_</span>
						<span>_</span>
					{:then data}
						<span>
							{data.map((c) => c.tests).filter((t) => t !== undefined).length}
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

			{#if i === $currentSemester}
				{#await Promise.all(semester.map(getCourseData))}
					<div />
				{:then courses}
					<div class="space-y-1">
						<div class="flex flex-row text-content-primary">
							{#each getStudyDays(courses, 0) as [course, days]}
								<div
									style="background: {generateCourseColor(course)}"
									class="mr-1 w-6 p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
								>
									{days}
								</div>
							{/each}
						</div>
						<div class="flex flex-row text-content-primary">
							{#each getStudyDays(courses, 1) as [course, days]}
								<div
									style="background: {generateCourseColor(course)}"
									class="mr-1 w-6 p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
								>
									{days}
								</div>
							{/each}
						</div>
					</div>
				{/await}
			{/if}

			<div class="flex flex-col space-y-2">
				{#each semester as code}
					{#await getCourseData(code) then course}
						<div
							class="container"
							tabindex={i}
							role="button"
							on:mousedown={() => goto(`/course/${course.code}`)}
						>
							<CourseElement
								{course}
								requirements={$degreeData?.then((d) =>
									getCourseLists(d.requirements, course.code)
								)}
							/>
						</div>
					{/await}
				{/each}
			</div>
		</div>
	{/each}
</div>
