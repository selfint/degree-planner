<script lang="ts">
	import { goto } from '$app/navigation';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';

	import LoLoCo from './components/LoLoCo.svelte';

	import {
		semesters,
		degreeData,
		currentSemester,
		wishlist
	} from '$lib/stores';
	import { getCourseData, getAllCourses } from '$lib/courseData';
	import { getScheduleError } from '$lib/schedule';
	import {
		getCourseLists,
		getDegreeRequirementCourses
	} from '$lib/requirements';
	import StudyDaysComponent from '$lib/components/StudyDaysComponent.svelte';

	$: semester = $semesters.at($currentSemester)?.map(getCourseData) ?? [];
	$: disabled = [] as string[];
	$: effectiveSemester = semester.filter((c) => !disabled.includes(c.code));

	$: futureSemesters = $semesters
		.slice($currentSemester + 1)
		.map((s, i): [number, Course[]] => [
			$currentSemester + 1 + i,
			s.map(getCourseData)
		]);

	$: wishlistCourses = $wishlist.map(getCourseData);
	$: requirementCourses = $degreeData?.then((d) =>
		getDegreeRequirementCourses(d.requirements).map(({ path, courses }) => ({
			path,
			courses: courses.map(getCourseData)
		}))
	);

	function getAvgMedian(courses: Course[]): number {
		const medians: number[] = courses
			.map((c) => c.median)
			.filter((m) => m !== undefined);

		return medians.length > 0
			? Math.round((medians.reduce((a, b) => a + b) / medians.length) * 10) / 10
			: 0;
	}

	function compareCourses(courses: Course[], a: Course, b: Course): number {
		const medianDiff = (b.median ?? 0) - (a.median ?? 0);
		const studyDaysDiff0 =
			getCourseStudyDays(courses, 0, b) - getCourseStudyDays(courses, 0, a);
		const studyDaysDiff1 =
			getCourseStudyDays(courses, 1, b) - getCourseStudyDays(courses, 1, a);

		return 1 * medianDiff + 0.2 * studyDaysDiff0 + 0.01 * studyDaysDiff1;
	}

	async function getLoLoCo(
		wishlistCourses: Course[],
		futureSemesters: [number, Course[]][],
		requirementCourses?:
			| Promise<
					{
						path: string[];
						courses: Course[];
					}[]
			  >
			| undefined
	): Promise<[string, Course[]][]> {
		let lists: [string, Course[]][] = [];

		lists.push(['Wishlist', wishlistCourses]);

		for (const [index, courses] of futureSemesters) {
			lists.push([`Semester ${index + 1}`, courses]);
		}

		if (requirementCourses !== undefined) {
			for (const { path, courses } of await requirementCourses) {
				lists.push([path.join(' '), courses]);
			}
		}

		function sortCourses(courses: Course[]): Course[] {
			return courses
				.filter(
					(c) =>
						true ||
						Math.min(
							...(getStudyDays(courses.concat(c), 0)?.next ?? []).map(
								([_, d]) => d
							)
						) > 2
				)
				.sort((a, b) => compareCourses(courses, a, b));
		}

		lists = lists
			.map(
				([title, courses]) =>
					[title, sortCourses(courses.filter(courseCanBeTaken))] as [
						string,
						Course[]
					]
			)
			.filter(([_, courses]) => courses.length > 0);

		lists.push([
			'Other',
			sortCourses(
				getAllCourses()
					.filter(courseCanBeTaken)
					.filter((c) => !wishlistCourses.some((w) => w.code === c.code))
					.filter(
						(c) =>
							!futureSemesters
								.map(([, courses]) => courses)
								.flat()
								.some((f) => f.code === c.code)
					)
			).slice(0, 30)
		]);

		return lists;
	}

	function getCourseStudyDays(
		courses: Course[],
		test: 0 | 1,
		course: Course
	): number {
		const studyDays = getStudyDays(courses, test);

		const courseDays = studyDays?.next.find(([c]) => c.code === course.code);

		// course has no tests
		if (courseDays === undefined) {
			return -1;
		}

		return courseDays?.[1];
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
				const t0 = c.tests?.[0] ?? undefined;
				const t1 = c.tests?.[1] ?? undefined;

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

	function courseCanBeTaken(course: Course): boolean {
		if (course.name === undefined) {
			return false;
		}

		if (course.current !== true) {
			return false;
		}

		if (
			$semesters
				.slice(0, $currentSemester + 1)
				.flat()
				.some((c) => c === course.code)
		) {
			return false;
		}

		const error = getScheduleError(course, $semesters, $currentSemester, true);

		const canTake =
			error.season === undefined &&
			error.dependencies.length === 0 &&
			error.adjacencies.length === 0 &&
			error.exclusives.length === 0;

		return canTake;
	}

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1))
			.join(' ');
	}

	function toggleCourseDisabled(course: Course) {
		if (disabled.includes(course.code)) {
			disabled = disabled.filter((c) => c !== course.code);
		} else {
			disabled = [...disabled, course.code];
		}
	}
</script>

<div class="m-3 mr-0 mt-0 items-start sm:mt-3 sm:flex sm:flex-row">
	<div class="sticky top-2 mr-3 mt-0 hidden touch-manipulation sm:block">
		<Semester index={$currentSemester} {semester} {disabled} isCurrent={true}>
			<button
				slot="course"
				let:course
				class={disabled.includes(course.code) ? 'opacity-50' : ''}
				on:mousedown={() => toggleCourseDisabled(course)}
			>
				<CourseElement
					{course}
					lists={$degreeData?.then((d) =>
						getCourseLists(d.requirements, course.code)
					)}
				/>
			</button>
		</Semester>
	</div>

	<div class="sticky top-0 bg-background pb-2 sm:hidden">
		<div class="mb-2 mr-3 mt-1 flex flex-row items-center justify-between pt-2">
			<div>
				<h1
					class="border-b-2 border-accent-primary text-lg font-medium text-content-primary"
				>
					{['Winter', 'Spring', 'Summer'][$currentSemester % 3]}
					{Math.floor($currentSemester / 3) + 1}
				</h1>
				<div class="text-content-secondary">
					<span>
						{effectiveSemester
							.map((c) => c.tests)
							.filter((t) => t !== undefined && t.length > 0).length}
					</span>
					<span>
						{getAvgMedian(effectiveSemester)}
					</span>
					<span>
						{effectiveSemester.reduce((a, b) => a + (b.points ?? 0), 0)}
					</span>
				</div>
			</div>
			<StudyDaysComponent semester={effectiveSemester} />
		</div>
		<div class="flew-row flex touch-manipulation space-x-2 overflow-x-auto">
			{#each semester as course}
				<button
					class={disabled.includes(course.code) ? 'opacity-50' : ''}
					on:mousedown={() => toggleCourseDisabled(course)}
				>
					<CourseElement
						{course}
						lists={$degreeData?.then((d) =>
							getCourseLists(d.requirements, course.code)
						)}
					/>
				</button>
			{/each}
		</div>
	</div>

	<div class="flex-1 overflow-x-auto">
		{#await getLoLoCo(wishlistCourses, futureSemesters, requirementCourses)}
			<div class="text-content-primary">Loading...</div>
		{:then loloco}
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
					tabindex={i}
					role="button"
					on:click={() => goto(`/course/${course.code}`)}
					on:keydown={(e) => {
						if (e.key === 'Enter') {
							goto(`/course/${course.code}`);
						}
					}}
					class="h-fit rounded-md bg-card-secondary"
				>
					<CourseElement
						{course}
						lists={$degreeData?.then((d) =>
							getCourseLists(d.requirements, course.code)
						)}
						variant={{
							type: 'test',
							semester: effectiveSemester
						}}
					/>
				</div>
			</LoLoCo>
		{/await}
	</div>
</div>

<style>
	:global(body) {
		overscroll-behavior: none;
	}
</style>
