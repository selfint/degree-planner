<script lang="ts">
	export let index: number;
	export let courses: Promise<Course[]>;

	const season = ['Winter', 'Spring', 'Summer'][index % 3];
	const number = Math.floor(index / 3) + 1;

	const title = `${season} ${number}`;

	function getData(courses: Course[]) {
		return {
			title,
			tests: courses
				.map((c) => c.tests)
				.filter((t) => t !== undefined && t.length > 0).length,
			avg: getAvgMedian(courses),
			points:
				courses.map((c) => c.points).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ??
				0,
			first: getStudyDays(courses, 0),
			second: getStudyDays(courses, 1)
		};
	}

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
</script>

<div class="w-[220px] space-y-2">
	<div>
		{#await courses}
			<div>Loading...</div>
		{:then courses}
			<slot name="header" data={getData(courses)} />
		{/await}
	</div>
	<div class="space-y-2">
		{#await courses}
			<div>Loading...</div>
		{:then courses}
			{#each courses as course, i}
				<slot name="course" {course} {i} />
			{/each}
		{/await}
	</div>
</div>
