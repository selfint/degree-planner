<script lang="ts">
	import {
		semesters,
		degreeData,
		currentSemester,
		wishlist
	} from '$lib/stores';

	import { getCourseData } from '$lib/courseData';

	import { generateCourseColor } from '$lib/colors';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import { getCourseLists } from '$lib/requirements';

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

	const semester = Promise.all(
		$semesters.at($currentSemester)?.map(getCourseData) ?? []
	);
</script>

<div class="m-3">
	{#await semester}
		<p>Loading...</p>
	{:then semester}
		<div class="w-fit">
			<div class="w-[220px]" />
			<div class="mb-2 flex flex-row items-baseline justify-between">
				<h1
					class="border-b-2 border-b-transparent text-2xl font-medium text-content-primary"
				>
					{['Winter', 'Spring', 'Summer'][$currentSemester % 3]}
					{Math.floor($currentSemester / 3) + 1}
				</h1>

				<div
					class="flex flex-row items-baseline justify-end space-x-1 text-content-secondary"
				>
					<span>
						{semester
							.map((c) => c.tests)
							.filter((t) => t !== undefined && t.length > 0).length}
					</span>
					<span>
						{getAvgMedian(semester)}
					</span>
					<span>
						{semester.reduce((a, b) => a + (b.points ?? 0), 0)}
					</span>
				</div>
			</div>
			<div class="mb-4 w-full space-y-1">
				<div class="flex flex-row flex-wrap text-content-primary">
					{#each getStudyDays(semester, 0) as [course, days]}
						<div
							style="background: {generateCourseColor(course)}"
							class="mb-1 mr-0.5 w-6 p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
						>
							{days}
						</div>
					{/each}
				</div>
				<div class="flex w-full flex-row flex-wrap text-content-primary">
					{#each getStudyDays(semester, 1) as [course, days]}
						<div
							style="background: {generateCourseColor(course)}"
							class="mb-1 mr-0.5 w-6 p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
						>
							{days}
						</div>
					{/each}
				</div>
			</div>
			<div class="flex flex-col space-y-2">
				{#each semester as course}
					<CourseElement
						{course}
						requirements={$degreeData?.then((d) =>
							getCourseLists(d.requirements, course.code)
						)}
					/>
				{/each}
			</div>
		</div>
	{/await}
</div>
