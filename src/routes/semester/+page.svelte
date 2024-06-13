<script lang="ts">
	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from './components/Semester.svelte';

	import {
		semesters,
		degreeData,
		currentSemester,
		wishlist
	} from '$lib/stores';
	import { getCourseData } from '$lib/courseData';
	import { generateCourseColor } from '$lib/colors';
	import { getCourseLists } from '$lib/requirements';

	const semester = Promise.all(
		$semesters.at($currentSemester)?.map(getCourseData) ?? []
	);

	const loloco = semester.then((semester) => {});

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

	function courseDependenciesSatisfied(course: Course): boolean {
		const previousCourses = $semesters.slice(0, $currentSemester).flat();

		const dependencies = course.connections?.dependencies ?? [];

		const ok =
			dependencies.length === 0 ||
			dependencies.some((dependencyGroup) =>
				dependencyGroup.every((dependency) =>
					previousCourses.some((code) => code === dependency)
				)
			);

		console.log([course, dependencies, ok]);

		return ok;
	}
</script>

<div class="m-3 flex flex-row space-x-4">
	<Semester index={$currentSemester} courses={semester}>
		<div slot="header" let:data>
			<div class="flex flex-row items-baseline justify-between">
				<h1
					class="border-b-2 border-b-transparent text-2xl font-medium text-content-primary"
				>
					{data.title}
				</h1>
				<div
					class="flex flex-row items-baseline justify-end space-x-1 text-content-secondary"
				>
					<span>{data.tests}</span>
					<span>{data.avg}</span>
					<span>{data.points}</span>
				</div>
			</div>
			<div class="flex flex-row flex-wrap text-content-primary">
				{#each data.first as [course, days]}
					<div
						style="background: {generateCourseColor(course)}"
						class="mb-1 mr-0.5 w-6 p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
					>
						{days}
					</div>
				{/each}
			</div>
			<div class="flex flex-row flex-wrap text-content-primary">
				{#each data.second as [course, days]}
					<div
						style="background: {generateCourseColor(course)}"
						class="mb-1 mr-0.5 w-6 p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
					>
						{days}
					</div>
				{/each}
			</div>
		</div>

		<div slot="course" let:course>
			<CourseElement
				{course}
				requirements={$degreeData?.then((d) =>
					getCourseLists(d.requirements, course.code)
				)}
			/>
		</div>
	</Semester>
</div>
