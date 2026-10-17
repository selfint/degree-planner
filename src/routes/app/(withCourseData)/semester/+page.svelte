<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';
	import StudyDaysComponent from '$lib/components/StudyDaysComponent.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';

	import { user, content, requirement } from '$lib/stores.svelte';
	import { getScheduleError } from '$lib/schedule';
	import { getDegreeRequirementCourses } from '$lib/requirements';
	import Spinner from '$lib/components/Spinner.svelte';

	const { data: pageData } = $props();
	const { getCourseData } = $derived(pageData);

	let disabled: string[] = $state([]);

	const currentSemester = $derived.by(() => {
		const current = page.url.searchParams.get('c');

		if (current === null) {
			return user.d.currentSemester;
		} else {
			return parseInt(current.trim());
		}
	});

	const wishlistCourses = $derived(user.d.wishlist);
	const semester = $derived(user.d.semesters.at(currentSemester) ?? []);

	const effectiveSemester = $derived.by(() =>
		semester.filter((c) => !disabled.includes(c))
	);

	const _effectiveSemester = $derived.by(
		async () => await Promise.all(effectiveSemester.map(getCourseData))
	);

	const futureSemesters = $derived.by(() =>
		user.d.semesters
			.slice(currentSemester + 1)
			.map(
				(s: CourseCode[], i: number) => [currentSemester + 1 + i, s] as const
			)
	);

	const requirementCourses = $derived.by(() => {
		const r = requirement();
		if (r === undefined) {
			return undefined;
		}

		return r.then((r) =>
			getDegreeRequirementCourses(r).map(({ path, courses }) => ({
				path,
				courses: courses
			}))
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

	// list of lists of courses
	const loLoCo = $derived.by(async () => {
		let lists: [Requirement[], CourseCode[], boolean][] = [];

		lists.push([
			[
				{
					name: content.lang.semester.wishlist,
					en: content.lang.semester.wishlist,
					he: content.lang.semester.wishlist
				}
			],
			wishlistCourses,
			false
		]);

		for (const [index, courses] of futureSemesters) {
			const season = content.lang.common.seasons[index % 3];
			const year = Math.floor(index / 3) + 1;
			const name = `${season} ${year}`;
			lists.push([[{ name, en: name, he: name }], courses, false]);
		}

		if (requirementCourses !== undefined) {
			for (const { path, courses } of await requirementCourses) {
				lists.push([path, courses, true]);
			}
		}

		return lists.filter(([_, courses]) => courses.length > 0);
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

	async function styleOnCourse(course: Course): Promise<string> {
		const styleOnCannotTake = 'opacity: 0.6';

		if (course.name === undefined) {
			return styleOnCannotTake;
		}

		if (!course.current) {
			return styleOnCannotTake;
		}

		if (
			user.d.semesters
				.slice(0, currentSemester + 1)
				.flat()
				.some((c) => c === course.code)
		) {
			return styleOnCannotTake;
		}

		if (user.d.exemptions.includes(course.code)) {
			return styleOnCannotTake;
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

		return canTake ? '' : styleOnCannotTake;
	}

	function toggleCourseDisabled(code: string) {
		if (disabled.includes(code)) {
			disabled = disabled.filter((c) => c !== code);
		} else {
			disabled = [...disabled, code];
		}
	}

	const seasonEmojis = ['❄️', '🌿', '☀️'];
</script>

{#snippet courseNote(course: Course, se: Promise<ScheduleError>)}
	{#if !course.current}
		❌
		<span dir={content.lang.dir} class="hidden sm:inline">
			{content.lang.common.no}
			{content.lang.course.available}
		</span>
	{:else if user.d.semesters
		.slice(0, currentSemester + 1)
		.flat()
		.some((c) => c === course.code)}
		{@const index = user.d.semesters.findIndex((c) => c.includes(course.code))}
		{seasonEmojis[index % 3]}
		<span dir={content.lang.dir} class="hidden sm:inline">
			{content.lang.common.seasons[index % 3]}
			{Math.floor(index / 3) + 1}
		</span>
	{:else if user.d.exemptions.includes(course.code)}
		✓
		<span class="hidden sm:inline">
			{content.lang.catalog.exempt}
		</span>
	{:else}
		{#await se then se}
			{#if (se?.dependencies ?? []).flat().length > 0 || (se?.adjacencies ?? []).length > 0 || (se?.exclusives ?? []).length > 0}
				📚
				<span dir={content.lang.dir} class="hidden sm:inline">
					{content.lang.common.dependencies}
				</span>
			{/if}
		{/await}
	{/if}
{/snippet}

<div class="semester-page items-start sm:mt-5 sm:flex sm:flex-row">
	<div
		class="semester-sidebar sticky top-3 mb-4 mt-0 hidden max-h-screen shrink-0 touch-manipulation overflow-y-auto pb-4 pe-4 ps-4 sm:block"
	>
		<Semester
			{getCourseData}
			index={currentSemester}
			{semester}
			{disabled}
			isCurrent={currentSemester === user.d.currentSemester}
			href={'/app/plan'}
		>
			{#snippet children({ code, course })}
				<button
					class="rounded-[var(--radius-card)] text-start {disabled.includes(
						code
					)
						? 'opacity-50'
						: ''}"
					onmousedown={() => toggleCourseDisabled(code)}
				>
					<CourseElement {code} {course} />
				</button>
			{/snippet}
		</Semester>
	</div>

	<div
		class="semester-mobile sticky top-0 z-30 mb-6 bg-background pb-3 sm:hidden"
	>
		<div
			class="mb-3 me-3 mt-1 flex flex-row flex-wrap items-center justify-between gap-3 pt-3"
		>
			<div class="ms-3">
				<h1
					class="w-fit border-b-2 {currentSemester === user.d.currentSemester
						? 'border-accent-primary'
						: 'border-transparent'} text-base font-semibold text-content-primary"
				>
					{content.lang.common.seasons[currentSemester % 3]}
					{Math.floor(currentSemester / 3) + 1}
				</h1>
				<div class="mobile-semester-summary">
					{#await _effectiveSemester then effectiveSemester}
						<span
							><strong
								>{effectiveSemester
									.map((c) => c.tests)
									.filter((t) => t !== undefined && t.length > 0)
									.length}</strong
							>
							{content.lang.lang === 'he' ? 'מבחנים' : 'exams'}</span
						>
						<span
							><strong>{getAvgMedian(effectiveSemester)}</strong>
							{content.lang.course.median}</span
						>
						<span
							><strong
								>{effectiveSemester.reduce(
									(a, b) => a + (b.points ?? 0),
									0
								)}</strong
							>
							{content.lang.course.points}</span
						>
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
					class="rounded-[var(--radius-card)] text-start {disabled.includes(
						code
					)
						? 'opacity-50'
						: ''}"
					onmousedown={() => toggleCourseDisabled(code)}
				>
					<CourseElement {code} {course} />
				</button>
			{/snippet}
		</CourseRow>
	</div>

	<div class="relative z-0 min-w-0 flex-1 overflow-x-auto sm:pe-4">
		{#await loLoCo}
			<h2 class="flex flex-row text-content-primary">
				{content.lang.common.loading}
				<div class="me-1 h-5 w-5">
					<Spinner />
				</div>
			</h2>
		{:then loLoCo}
			{#each loLoCo as [titles, courses, colorize]}
				<div class="mb-8">
					<h2
						class="mb-3 ms-3 text-sm font-semibold text-content-primary sm:ms-0"
					>
						<div
							class="me-2 flex flex-row flex-wrap items-start gap-x-1.5 gap-y-1"
						>
							{#each titles as title, titleIndex}
								{#if titleIndex > 0}<span
										class="text-content-secondary"
										aria-hidden="true">/</span
									>{/if}
								<span class="leading-relaxed">
									{content.lang.lang === 'he' ? title.he : title.en}
								</span>
							{/each}
						</div>
					</h2>

					<div class="sm:hidden">
						<CourseRow
							{getCourseData}
							indent={1}
							{courses}
							checkScheduleError={(course) =>
								getScheduleError(
									getCourseData,
									course,
									user.d.exemptions,
									user.d.semesters,
									currentSemester + 1,
									true
								)}
						>
							{#snippet children({ code, course, scheduleError })}
								<button
									class="rounded-[var(--radius-card)] text-start"
									onmousedown={() => goto(`/app/course/${code}`)}
								>
									<CourseElement
										{code}
										{course}
										tests={currentSemester === user.d.currentSemester
											? _effectiveSemester
											: undefined}
										{styleOnCourse}
									>
										{#snippet note(course)}
											{@render courseNote(course, scheduleError!)}
										{/snippet}
									</CourseElement>
								</button>
							{/snippet}
						</CourseRow>
					</div>
					<div class="hidden sm:block">
						<CourseRow
							{getCourseData}
							indent={0}
							{courses}
							checkScheduleError={(course) =>
								getScheduleError(
									getCourseData,
									course,
									user.d.exemptions,
									user.d.semesters,
									currentSemester + 1,
									true
								)}
						>
							{#snippet children({ code, course, scheduleError })}
								<button
									class="rounded-[var(--radius-card)] text-start"
									onmousedown={() => goto(`/app/course/${code}`)}
								>
									<CourseElement
										{code}
										{course}
										tests={currentSemester === user.d.currentSemester
											? _effectiveSemester
											: undefined}
										{styleOnCourse}
									>
										{#snippet note(course)}
											{@render courseNote(course, scheduleError!)}
										{/snippet}
									</CourseElement>
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
	.semester-sidebar {
		scrollbar-width: thin;
	}
	.semester-mobile {
		border-block-end: 0.0625rem solid rgb(var(--color-border));
	}
	.mobile-semester-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		margin-block-start: 0.5rem;
		color: rgb(var(--color-content-secondary));
		font-size: 0.6875rem;
	}
	.mobile-semester-summary strong {
		color: rgb(var(--color-content-primary));
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	:global(body) {
		overscroll-behavior: none;
	}
</style>
