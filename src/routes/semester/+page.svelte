<script lang="ts">
	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from './components/Semester.svelte';
	import LoLoCo from './components/LoLoCo.svelte';

	import {
		semesters,
		degreeData,
		currentSemester,
		wishlist
	} from '$lib/stores';
	import { getCourseData, getAllCourses } from '$lib/courseData';
	import { generateCourseColor } from '$lib/colors';
	import {
		getCourseLists,
		getDegreeRequirementCourses
	} from '$lib/requirements';
	import { stringify } from 'postcss';

	const semester = Promise.all(
		$semesters.at($currentSemester)?.map(getCourseData) ?? []
	);

	const futureSemesters = Promise.all(
		$semesters
			.slice($currentSemester + 1)
			.map(
				async (s, i): Promise<[number, Course[]]> => [
					$currentSemester + 1 + i,
					await Promise.all(s.map(getCourseData))
				]
			)
	);
	const wishlistCourses = Promise.all($wishlist.map(getCourseData));
	const requirementCourses = $degreeData?.then((d) =>
		Promise.all(
			getDegreeRequirementCourses(d.requirements).map(
				async ({ path, courses }) => {
					return {
						path,
						courses: await Promise.all(courses.map(getCourseData))
					};
				}
			)
		)
	);

	function compareCourses(courses: Course[], a: Course, b: Course): number {
		const medianDiff = (b.median ?? 0) - (a.median ?? 0);
		const studyDaysDiff0 =
			getCourseStudyDays(courses, 0, b) - getCourseStudyDays(courses, 0, a);
		const studyDaysDiff1 =
			getCourseStudyDays(courses, 1, b) - getCourseStudyDays(courses, 1, a);

		return 1 * medianDiff + 0.2 * studyDaysDiff0 + 0.01 * studyDaysDiff1;
	}

	async function getLoLoCo(): Promise<[string, Course[]][]> {
		const list: [string, Course[]][] = [];

		// filter wishlist courses
		const wishlist: Course[] = [];
		for (const course of await wishlistCourses) {
			if (courseCanBeTaken(course)) {
				wishlist.push(course);
			}
		}

		list.push(['Wishlist', wishlist]);

		for (const [index, courses] of await futureSemesters) {
			const semesterCourses = courses.filter(courseCanBeTaken);

			list.push([`Semester ${index + 1}`, semesterCourses]);
		}

		if (requirementCourses !== undefined) {
			for (const { path, courses } of await requirementCourses) {
				const filteredCourses = courses.filter(courseCanBeTaken);

				list.push([path.join(' '), filteredCourses]);
			}
		}

		const currentSemesterCourses = await semester;
		function sortCourses(courses: Course[]): Course[] {
			return courses
				.filter((c) => !currentSemesterCourses.some((cc) => cc.code === c.code))
				.filter(
					(c) =>
						Math.min(
							...getStudyDays(currentSemesterCourses.concat(c), 0).map(
								([_, d]) => d
							)
						) > 2
				)
				.sort((a, b) => compareCourses(currentSemesterCourses, a, b));
		}

		return list
			.map(
				([title, courses]) =>
					[title, sortCourses(courses)] as [string, Course[]]
			)
			.filter(([_, courses]) => courses.length > 0);
	}

	function getCourseStudyDays(
		courses: Course[],
		test: 0 | 1,
		course: Course
	): number {
		const studyDays = getStudyDays(courses, test);

		const courseDays = studyDays.find(([c]) => c.code === course.code);

		// course has no tests
		if (courseDays === undefined) {
			return -1;
		}

		return courseDays?.[1];
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

	function courseCanBeTaken(course: Course): boolean {
		const previousCourses = $semesters.slice(0, $currentSemester).flat();

		if (previousCourses.some((c) => c === course.code)) {
			return false;
		}

		const dependencies = course.connections?.dependencies ?? [];

		return (
			dependencies.length === 0 ||
			dependencies.some((dependencyGroup) =>
				dependencyGroup.every((dependency) =>
					previousCourses.some((code) => code === dependency)
				)
			)
		);
	}

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1))
			.join(' ');
	}
</script>

<div class="m-3 flex flex-row items-start space-x-4">
	<div class="sticky top-[76px]">
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
	<div class="flex-1 overflow-x-auto">
		{#await getLoLoCo()}
			Loading...
		{:then loloco}
			<div class="">
				<LoLoCo {loloco}>
					<h1
						slot="header"
						let:title
						class="text-lg font-medium text-content-primary"
					>
						{formatName(title)}
					</h1>

					<div
						slot="course"
						let:course
						let:i
						class="h-fit rounded-md bg-card-secondary"
					>
						<CourseElement
							{course}
							requirements={$degreeData?.then((d) =>
								getCourseLists(d.requirements, course.code)
							)}
						/>
						<div class="h-fit pb-1 pl-2 pt-2">
							{#await semester then semester}
								<div class="flex flex-row flex-wrap text-content-primary">
									{#each getStudyDays(semester.concat(course), 0) as [c, days]}
										<div
											style="background: {generateCourseColor(c)}"
											class="mb-1 mr-0.5 w-6 {c.code === course.code
												? 'border border-content-primary'
												: ''} p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
										>
											{days}
										</div>
									{/each}
								</div>
								<div class="flex flex-row flex-wrap text-content-primary">
									{#each getStudyDays(semester.concat(course), 1) as [c, days]}
										<div
											style="background: {generateCourseColor(c)}"
											class="mb-1 mr-0.5 w-6 {c.code === course.code
												? 'border border-content-primary'
												: ''} p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
										>
											{days}
										</div>
									{/each}
								</div>
							{/await}
						</div>
					</div>
				</LoLoCo>
			</div>
		{/await}
	</div>
</div>

<style>
	:global(body) {
		overscroll-behavior: none;
	}
</style>
