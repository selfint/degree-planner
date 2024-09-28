<script lang="ts">
	import { goto, beforeNavigate } from '$app/navigation';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';

	import {
		semesters,
		degreeData,
		currentSemester,
		wishlist
	} from '$lib/stores';

	import { buildGetCourseData } from '$lib/courseData';
	import { getCourseLists } from '$lib/requirements';
	import { getScheduleError } from '$lib/schedule';

	const { abort, getCourseData } = buildGetCourseData();

	beforeNavigate(() => {
		abort();
	});

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

	function moveCourseToSemester(code: string, semester: number) {
		$wishlist = $wishlist.filter((c) => c !== code);
		$semesters = $semesters.map((s, i) =>
			i === semester ? [...new Set([...s, code])] : s.filter((c) => c !== code)
		);
	}

	function moveCourseToWishlist(code: string) {
		$wishlist = [...new Set([...$wishlist, code])];
		$semesters = $semesters.map((s) => s.filter((c) => c !== code));
	}
</script>

<div class="m-3 mr-0">
	<div
		class="mb-4 min-h-[118px]"
		on:dragenter={(e) => {
			if (e.dataTransfer?.types.includes('text/x-course')) {
				e.preventDefault();
			}
		}}
		on:dragover|preventDefault={(e) => {
			if (e.dataTransfer !== null) {
				e.dataTransfer.dropEffect = 'move';
			}
		}}
		on:dragleave|preventDefault
		on:drop|preventDefault={(e) => {
			const code = e.dataTransfer?.getData('text/x-course');
			if (code !== undefined) {
				moveCourseToWishlist(code);
			}
		}}
		role="button"
		tabindex={0}
	>
		<h1 class="mb-2 text-2xl font-medium text-content-primary">Wish list</h1>
		<div class="flex flex-row space-x-2 overflow-x-auto">
			{#await Promise.all($wishlist.map(getCourseData)) then courses}
				{#each courses as course, i}
					<div
						class="container w-fit"
						draggable="true"
						tabindex={i}
						role="button"
						on:dragstart={(e) =>
							e.dataTransfer?.setData('text/x-course', course.code)}
						on:click={() => goto(`/course/${course.code}`)}
						on:keydown={(e) => {
							if (e.key === 'Enter') {
								goto(`/course/${course.code}`);
							}
						}}
					>
						<CourseElement
							{course}
							lists={$degreeData?.then((d) =>
								getCourseLists(d.requirements, course.code)
							)}
						/>
					</div>
				{/each}
			{/await}
		</div>
	</div>
	<div style="transform: rotateX(180deg)" class="overflow-x-auto">
		<div style="transform: rotateX(180deg)" class="flex flex-row space-x-3">
			{#key $semesters.flat().join(' ')}
				{#each $semesters as semester, semesterIndex}
					<div
						on:dragenter={(e) => {
							if (e.dataTransfer?.types.includes('text/x-course')) {
								e.preventDefault();
							}
						}}
						on:dragover|preventDefault={(e) => {
							if (e.dataTransfer !== null) {
								e.dataTransfer.dropEffect = 'move';
							}
						}}
						on:dragleave|preventDefault
						on:drop|preventDefault={(e) => {
							const code = e.dataTransfer?.getData('text/x-course');
							if (code !== undefined) {
								moveCourseToSemester(code, semesterIndex);
							}
						}}
						role="button"
						tabindex={semesterIndex}
					>
						<Semester
							index={semesterIndex}
							courses={semester.map(getCourseData)}
							isCurrent={semesterIndex === $currentSemester}
						>
							<div
								slot="course"
								let:course
								let:index={j}
								draggable="true"
								tabindex={j}
								role="button"
								class="text-content-primary"
								on:dragstart={(e) => {
									if (e.dataTransfer !== null) {
										e.dataTransfer.setData('text/x-course', course.code);
										e.dataTransfer.effectAllowed = 'move';
									}
								}}
								on:click={() => goto(`/course/${course.code}`)}
								on:keydown={(e) => {
									if (e.key === 'Enter') {
										goto(`/course/${course.code}`);
									}
								}}
							>
								<CourseElement
									{course}
									lists={$degreeData?.then((d) =>
										getCourseLists(d.requirements, course.code)
									)}
									variant={{
										type: 'schedule',
										error: getScheduleError(course, $semesters, semesterIndex)
									}}
								/>
							</div>
						</Semester>
					</div>
				{/each}
			{/key}
		</div>
	</div>
</div>
