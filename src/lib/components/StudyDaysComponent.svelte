<script lang="ts">
	import { generateColor } from '$lib/colors';
	import { content } from '$lib/stores.svelte';

	type Props = {
		semester: Promise<Course[]>;
		course?: Course;
	};

	let { semester, course }: Props = $props();

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

	const semesterCourses = $derived.by(async () =>
		course === undefined ? await semester : (await semester).concat(course)
	);
	const days0 = $derived.by(async () => getStudyDays(await semesterCourses, 0));
	const days1 = $derived.by(async () => getStudyDays(await semesterCourses, 1));
</script>

{#await Promise.all([days0, days1]) then [days0, days1]}
	{#if days0 !== undefined || days1 !== undefined}
		<div class="study-days">
			{#each [days0, days1] as days, round}
				{#if days !== undefined}
					<div class="exam-round">
						<span class="sr-only">
							{content.lang.lang === 'he'
								? `מועד ${round === 0 ? 'א' : 'ב'}`
								: `Exam round ${round + 1}`}
						</span>
						<span
							style="background: {generateColor(days.first[0].code)}"
							class="study-chip"
							class:selected={days.first[0].code === course?.code}
							title={`${days.first[0].name ?? days.first[0].code}: ${days.first[1].getDate()}/${days.first[1].getMonth() + 1}`}
						>
							{days.first[1].getDate()}/{days.first[1].getMonth() + 1}
						</span>
						{#each days.next as [c, gap]}
							<span
								style="background: {generateColor(c.code)}"
								class="study-chip"
								class:selected={c.code === course?.code}
								title={`${c.name ?? c.code}: ${gap} ${content.lang.lang === 'he' ? 'ימים ללמידה' : 'study days'}`}
							>
								{gap}
							</span>
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	{/if}
{/await}

<style>
	.study-days {
		display: grid;
		gap: 0.25rem;
	}
	.exam-round {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.1875rem;
	}
	.study-chip {
		min-inline-size: 1.375rem;
		border: 0.0625rem solid transparent;
		border-radius: 0.25rem;
		padding: 0.125rem 0.25rem;
		color: #fff;
		font-size: 0.625rem;
		font-variant-numeric: tabular-nums;
		line-height: 1.25;
		text-align: center;
	}
	.study-chip.selected {
		border-color: rgb(var(--color-content-primary));
		outline: 0.0625rem solid rgb(var(--color-content-primary));
		outline-offset: 0.0625rem;
	}
</style>
