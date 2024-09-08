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
	import { buildGetCourseData } from '$lib/courseData';
	import { getScheduleError } from '$lib/schedule';
	import { generateCourseColor } from '$lib/colors';
	import {
		getCourseLists,
		getDegreeRequirementCourses
	} from '$lib/requirements';
	import { goto, beforeNavigate } from '$app/navigation';

	const { abort, getCourseData } = buildGetCourseData();

	beforeNavigate(() => {
		abort();
	});

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

		list.push(['Wishlist', await wishlistCourses]);

		for (const [index, courses] of await futureSemesters) {
			list.push([`Semester ${index + 1}`, courses]);
		}

		if (requirementCourses !== undefined) {
			for (const { path, courses } of await requirementCourses) {
				list.push([path.join(' '), courses]);
			}
		}

		const currentSemesterCourses = await semester;
		function sortCourses(courses: Course[]): Course[] {
			return courses
				.filter(
					(c) =>
						true || !currentSemesterCourses.some((cc) => cc.code === c.code)
				)
				.filter(
					(c) =>
						true ||
						Math.min(
							...(
								getStudyDays(currentSemesterCourses.concat(c), 0)?.next ?? []
							).map(([_, d]) => d)
						) > 2
				)
				.sort((a, b) => compareCourses(currentSemesterCourses, a, b));
		}

		return (
			await Promise.all(
				list.map(
					async ([title, courses]) =>
						[
							title,
							(
								await Promise.all(
									courses.map(
										async (c) => [c, await courseCanBeTaken(c)] as const
									)
								)
							)
								.filter(([, canTake]) => canTake)
								.map(([c]) => c)
						] as const
				)
			)
		)
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

	async function courseCanBeTaken(course: Course): Promise<boolean> {
		if (
			$semesters
				.slice($currentSemester + 1)
				.flat()
				.some((c) => c === course.code)
		) {
			return false;
		}

		const error = await getScheduleError(course, $semesters, $currentSemester);

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
</script>

<div class="m-3 mr-0 flex flex-row items-start space-x-4">
	<div class="sticky top-0">
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
					{#if data.first !== undefined}
						{@const days0 = data.first}
						<div
							style="background: {generateCourseColor(days0.first[0])}"
							class="mb-1 mr-0.5 w-fit p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
						>
							{days0.first[1].getDate()}/{days0.first[1].getMonth() + 1}
						</div>
						{#each days0.next as [c, days]}
							<div
								style="background: {generateCourseColor(c)}"
								class="mb-1 mr-0.5 w-6 p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
							>
								{days}
							</div>
						{/each}
					{/if}
				</div>
				<div class="flex flex-row flex-wrap text-content-primary">
					{#if data.second !== undefined}
						{@const days1 = data.second}
						<div
							style="background: {generateCourseColor(days1.first[0])}"
							class="mb-1 mr-0.5 w-fit p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
						>
							{days1.first[1].getDate()}/{days1.first[1].getMonth() + 1}
						</div>
						{#each days1.next as [c, days]}
							<div
								style="background: {generateCourseColor(c)}"
								class="mb-1 mr-0.5 w-6 p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
							>
								{days}
							</div>
						{/each}
					{/if}
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
			<div class="text-content-primary">Loading...</div>
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
							requirements={$degreeData?.then((d) =>
								getCourseLists(d.requirements, course.code)
							)}
						/>
						<div class="h-fit pb-1 pl-2 pt-2">
							{#await semester then semester}
								{@const days0 = getStudyDays(semester.concat(course), 0)}
								{@const days1 = getStudyDays(semester.concat(course), 1)}

								<div class="flex flex-row flex-wrap text-content-primary">
									{#if days0 !== undefined}
										<div
											style="background: {generateCourseColor(days0.first[0])}"
											class="mb-1 mr-0.5 w-fit border {days0.first[0].code ===
											course.code
												? 'border-content-primary'
												: 'border-transparent'} p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
										>
											{days0.first[1].getDate()}/{days0.first[1].getMonth() + 1}
										</div>
										{#each days0.next as [c, days]}
											<div
												style="background: {generateCourseColor(c)}"
												class="mb-1 mr-0.5 w-6 border {c.code === course.code
													? 'border-content-primary'
													: 'border-transparent'} p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
											>
												{days}
											</div>
										{/each}
									{/if}
								</div>
								<div class="flex flex-row flex-wrap text-content-primary">
									{#if days1 !== undefined}
										<div
											style="background: {generateCourseColor(days1.first[0])}"
											class="mb-1 mr-0.5 w-fit border {days1.first[0].code ===
											course.code
												? 'border-content-primary'
												: 'border-transparent'} p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
										>
											{days1.first[1].getDate()}/{days1.first[1].getMonth() + 1}
										</div>
										{#each days1.next as [c, days]}
											<div
												style="background: {generateCourseColor(c)}"
												class="mb-1 mr-0.5 w-6 border {c.code === course.code
													? 'border-content-primary'
													: 'border-transparent'} p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
											>
												{days}
											</div>
										{/each}
									{/if}
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
