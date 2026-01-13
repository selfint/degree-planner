<script lang="ts">
	import type { Snippet } from 'svelte';

	import Sortable from 'sortablejs';

	type Props = {
		getCourseData: GetCourseData;
		courses: CourseCode[] | Course[];
		indent?: number;
		children: Snippet<
			[
				{
					code: CourseCode;
					course: Promise<Course>;
					index: number;
					scheduleError?: Promise<ScheduleError>;
				}
			]
		>;
		resetScroll?: boolean;
		sortable?: Sortable.Options;
		checkScheduleError?: (course: Promise<Course>) => Promise<ScheduleError>;
	};

	let {
		getCourseData,
		courses,
		indent = 1,
		children,
		resetScroll = false,
		sortable,
		checkScheduleError
	}: Props = $props();

	const margin = $derived(`margin-inline-end: ${indent * 0.75}rem`);

	let loadingCourses: { code: CourseCode; course: Promise<Course> }[] =
		$derived(
			courses.map((c) => {
				if (typeof c === 'string') {
					return { code: c, course: getCourseData(c) };
				}

				return { code: c.code, course: Promise.resolve(c) };
			})
		);

	let sortedCourses:
		| undefined
		| Promise<{ code: CourseCode; course: Promise<Course> }[]> = $derived.by(
		() => {
			if (sortable !== undefined) {
				return undefined;
			}

			return Promise.all(loadingCourses.map((c) => c.course)).then(
				(courseRow) => {
					courseRow.sort((a, b) => {
						const medians = (b.median ?? 0) - (a.median ?? 0);

						if (medians !== 0) {
							return medians;
						}

						return (a.code ?? '').localeCompare(b.code ?? '');
					});

					return courseRow.map((c) => ({
						code: c.code,
						course: Promise.resolve(c)
					}));
				}
			);
		}
	);

	let row: HTMLDivElement;
	$effect(() => {
		if (row && resetScroll) {
			// Hack to get this effect to run each time the courses change
			row.scrollLeft = courses.length - courses.length;
		}
	});

	function makeSortable(row: HTMLDivElement) {
		if (sortable !== undefined) {
			sortable.filter = 'margin';
			new Sortable(row, sortable);
		}
	}
</script>

<div
	bind:this={row}
	use:makeSortable
	class="flex min-h-full flex-row items-start overflow-x-auto"
>
	<div class="margin" style={margin}></div>
	{#if sortedCourses === undefined}
		{#each loadingCourses as { code, course }, index}
			{@const scheduleError =
				checkScheduleError === undefined
					? undefined
					: checkScheduleError(course)}
			<div data-code={code} class="pe-2">
				{@render children({
					code,
					course,
					index,
					scheduleError
				})}
			</div>
		{/each}
	{:else}
		{#await sortedCourses then sortedCourses}
			{#each sortedCourses as { code, course }, index}
				{@const scheduleError =
					checkScheduleError === undefined
						? undefined
						: checkScheduleError(course)}
				<div data-code={code} class="pe-2">
					{@render children({
						code,
						course,
						index,
						scheduleError
					})}
				</div>
			{/each}
		{/await}
	{/if}
</div>
