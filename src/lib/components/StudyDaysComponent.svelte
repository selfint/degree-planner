<script lang="ts">
	import { generateCourseColor } from '$lib/colors';

	export let semester: Course[];
	export let course: Course | undefined = undefined;

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

	$: semesterCourses =
		course === undefined ? semester : semester.concat(course);
	$: days0 = getStudyDays(semesterCourses, 0);
	$: days1 = getStudyDays(semesterCourses, 1);
</script>

<div>
	<div class="mb-1 flex flex-row flex-wrap text-content-primary">
		{#if days0 !== undefined}
			<div
				style="background: {generateCourseColor(days0.first[0])}"
				class="mb-0.5 mr-0.5 w-fit border {days0.first[0].code === course?.code
					? 'border-content-primary'
					: 'border-transparent'} p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
			>
				{days0.first[1].getDate()}/{days0.first[1].getMonth() + 1}
			</div>
			{#each days0.next as [c, days]}
				<div
					style="background: {generateCourseColor(c)}"
					class="mb-0.5 mr-0.5 w-6 border {c.code === course?.code
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
				class="mb-0.5 mr-0.5 w-fit border {days1.first[0].code === course?.code
					? 'border-content-primary'
					: 'border-transparent'} p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
			>
				{days1.first[1].getDate()}/{days1.first[1].getMonth() + 1}
			</div>
			{#each days1.next as [c, days]}
				<div
					style="background: {generateCourseColor(c)}"
					class="mb-0.5 mr-0.5 w-6 border {c.code === course?.code
						? 'border-content-primary'
						: 'border-transparent'} p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
				>
					{days}
				</div>
			{/each}
		{/if}
	</div>
</div>
