<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';
	import StudyDaysComponent from '$lib/components/StudyDaysComponent.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';

	import { user, catalog, content } from '$lib/stores.svelte';
	import { getScheduleError } from '$lib/schedule';
	import {
		getDegreeRequirementCourses,
		loadRequirement
	} from '$lib/requirements';
	import LoadingCourseElement from '$lib/components/LoadingCourseElement.svelte';

	const { data: pageData } = $props();
	const { getCourseData, courseData } = pageData;

	let disabled: string[] = $state([]);

	const currentSemester = $derived.by(() => {
		const current = page.url.searchParams.get('c');

		if (current === null) {
			return user.d.currentSemester;
		} else {
			return parseInt(current.trim());
		}
	});

	const wishlistCourses = $derived(user.d.wishlist.map(getCourseData));
	const requirements =
		user.d.degree === undefined
			? undefined
			: loadRequirement(user.d.degree, user.d.path);
	const semester = $derived(user.d.semesters.at(currentSemester) ?? []);

	const effectiveSemester = $derived.by(() =>
		semester.filter((c) => !disabled.includes(c))
	);

	const _effectiveSemester = $derived.by(
		async () => await Promise.all(effectiveSemester.map(getCourseData))
	);

	const futureSemesters = $derived.by(
		async () =>
			await Promise.all(
				user.d.semesters
					.slice(currentSemester + 1)
					.map(
						async (s: string[], i: number) =>
							[
								currentSemester + 1 + i,
								await Promise.all(s.map(getCourseData))
							] as const
					)
			)
	);

	const requirementCourses = $derived.by(() => {
		if (requirements === undefined) {
			return undefined;
		}

		return getDegreeRequirementCourses(requirements).map(
			({ path, courses }) => ({
				path,
				courses: courses.map(getCourseData)
			})
		);
	});

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

	const loloco = $derived.by(async () => {
		let lists: [Requirement[], Course[], boolean][] = [];

		lists.push([
			[
				{
					name: content.lang.semester.wishlist,
					en: content.lang.semester.wishlist,
					he: content.lang.semester.wishlist
				}
			],
			await Promise.all(wishlistCourses),
			false
		]);

		for (const [index, courses] of await futureSemesters) {
			const season = content.lang.common.seasons[index % 3];
			const year = Math.floor(index / 3) + 1;
			const name = `${season} ${year}`;
			lists.push([[{ name, en: name, he: name }], courses, false]);
		}

		if (requirementCourses !== undefined) {
			for (const { path, courses } of requirementCourses) {
				lists.push([path, await Promise.all(courses), true]);
			}
		}

		lists = lists
			.map(
				([title, courses, colorize]) =>
					[title, sortCourses(courses.filter(courseCanBeTaken)), colorize] as [
						Requirement[],
						Course[],
						boolean
					]
			)
			.filter(([_, courses]) => courses.length > 0);

		return lists;
	});

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

	async function courseCanBeTaken(course: Course): Promise<boolean> {
		if (course.name === undefined) {
			return false;
		}

		if (course.current !== true) {
			return false;
		}

		if (
			user.d.semesters
				.slice(0, currentSemester + 1)
				.flat()
				.some((c) => c === course.code)
		) {
			return false;
		}

		if (user.d.exemptions.includes(course.code)) {
			return false;
		}

		const error = getScheduleError(
			getCourseData,
			course,
			user.d.exemptions,
			user.d.semesters,
			currentSemester + 1,
			true
		);

		const canTake = await error.then(
			(error) =>
				// error.season === undefined &&
				error.dependencies.length === 0 &&
				error.adjacencies.length === 0 &&
				error.exclusives.length === 0
		);

		return canTake;
	}

	function formatName(requirements: Requirement[]): string {
		let name = requirements.map((r) => r.name).join(' ');

		if (content.lang.lang === 'he') {
			name = requirements
				.map((r) => r.he ?? r.name)
				.join(' ')
				.split('_')
				.map((word) => word[0].toUpperCase() + word.slice(1))
				.join(' ');
		}

		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1))
			.join(' ');
	}

	function toggleCourseDisabled(code: string) {
		if (disabled.includes(code)) {
			disabled = disabled.filter((c) => c !== code);
		} else {
			disabled = [...disabled, code];
		}
	}
</script>

<div class="items-start sm:mt-3 sm:flex sm:flex-row">
	<div
		class="sticky top-2 mb-3 mt-0 hidden max-h-screen touch-manipulation overflow-y-scroll pe-3 ps-3 sm:block"
	>
		<Semester
			{getCourseData}
			index={currentSemester}
			{semester}
			{disabled}
			isCurrent={currentSemester === user.d.currentSemester}
			href={'/plan'}
		>
			{#snippet children({ code, course })}
				<button
					class={disabled.includes(code) ? 'opacity-50' : ''}
					onmousedown={() => toggleCourseDisabled(code)}
				>
					<CourseElement {code} {course} />
				</button>
			{/snippet}
		</Semester>
	</div>

	<div class="sticky top-0 mb-5 bg-background pb-2 sm:hidden">
		<div class="mb-2 me-3 mt-1 flex flex-row items-center justify-between pt-2">
			<div class="ms-3">
				<h1
					class="w-fit border-b-2 {currentSemester === user.d.currentSemester
						? 'border-accent-primary'
						: 'border-transparent'} text-base font-medium text-content-primary"
				>
					{content.lang.common.seasons[currentSemester % 3]}
					{Math.floor(currentSemester / 3) + 1}
				</h1>
				<div class="text-content-secondary">
					{#await _effectiveSemester then effectiveSemester}
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
					{/await}
				</div>
			</div>
			{#if currentSemester === user.d.currentSemester}
				<StudyDaysComponent semester={_effectiveSemester} />
			{/if}
		</div>
		<CourseRow {getCourseData} courses={semester}>
			{#snippet children({ code, course })}
				<button
					class={disabled.includes(code) ? 'opacity-50' : ''}
					onmousedown={() => toggleCourseDisabled(code)}
				>
					<CourseElement {code} {course} />
				</button>
			{/snippet}
		</CourseRow>
	</div>

	<div class="flex-1 overflow-x-auto">
		{#await loloco then loloco}
			{#each loloco as [titles, courses, colorize]}
				<div class="mb-7">
					<h1 class="mb-1.5 ms-3 font-medium text-content-primary sm:ms-0">
						<div class="me-2 flex flex-row flex-wrap items-start gap-y-1">
							{#each titles as title}
								<span class="me-1 leading-none">
									{content.lang.lang === 'he' ? title.he : title.en}
								</span>
							{/each}
						</div>
					</h1>

					<div class="sm:hidden">
						<CourseRow {getCourseData} indent={1} {courses}>
							{#snippet children({ code, course })}
								<button onmousedown={() => goto(`/course/${code}`)}>
									<CourseElement
										{code}
										{course}
										tests={currentSemester === user.d.currentSemester
											? _effectiveSemester
											: undefined}
									/>
								</button>
							{/snippet}
						</CourseRow>
					</div>
					<div class="hidden sm:block">
						<CourseRow {getCourseData} indent={0} {courses}>
							{#snippet children({ code, course })}
								<button onmousedown={() => goto(`/course/${code}`)}>
									<CourseElement
										{code}
										{course}
										tests={currentSemester === user.d.currentSemester
											? _effectiveSemester
											: undefined}
									/>
								</button>
							{/snippet}
						</CourseRow>
					</div>
				</div>
			{/each}
		{/await}
	</div>
</div>

<style>
	:global(body) {
		overscroll-behavior: none;
	}
</style>
