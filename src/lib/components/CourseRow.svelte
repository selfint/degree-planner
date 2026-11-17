<script lang="ts">
	import { keyedItems } from '$lib/keyedItems';
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
					course: Promise<Course> | Course;
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

	let loadingCourses: { code: CourseCode; course: Promise<Course> | Course }[] =
		$derived(
			courses.map((c) => {
				if (typeof c === 'string') {
					return { code: c, course: getCourseData(c) };
				}

				return { code: c.code, course: c };
			})
		);

	const readyCourses = $derived.by(() => {
		if (courses.some((course) => typeof course === 'string')) return undefined;
		const ready = [...(courses as Course[])];
		if (sortable === undefined)
			ready.sort(
				(a, b) =>
					(b.median ?? 0) - (a.median ?? 0) || a.code.localeCompare(b.code)
			);
		return ready.map((course) => ({ code: course.code, course }));
	});

	// Keep one keyed list while asynchronous course data changes its order.
	// Separate pending/resolved await blocks used to destroy every card twice.
	let sortedCourses = $state<typeof loadingCourses>();
	$effect(() => {
		const pending = loadingCourses;
		sortedCourses = undefined;
		if (sortable !== undefined || readyCourses !== undefined) return;
		let active = true;
		void Promise.all(pending.map((item) => item.course)).then((resolved) => {
			if (!active) return;
			sortedCourses = pending
				.map((item, index) => ({ item, data: resolved[index] }))
				.sort(
					(a, b) =>
						(b.data.median ?? 0) - (a.data.median ?? 0) ||
						a.item.code.localeCompare(b.item.code)
				)
				.map(({ item }) => item);
		});
		return () => {
			active = false;
		};
	});
	const displayedCourses = $derived(
		readyCourses ?? sortedCourses ?? loadingCourses
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
	class="course-row flex flex-row items-stretch overflow-x-auto pb-1"
>
	<div class="margin" style={margin}></div>
	{#each keyedItems(displayedCourses, (item) => item.code) as { key, value: { code, course } }, index (key)}
		{@const scheduleError = checkScheduleError?.(Promise.resolve(course))}
		<div data-code={code} class="course-row-item shrink-0 pe-2">
			{@render children({ code, course, index, scheduleError })}
		</div>
	{/each}
</div>

<style>
	/* Let the tallest intrinsic card size the row, then stretch through optional
	   links/buttons. A percentage row minimum would include the heading above. */
	.course-row-item,
	.course-row-item > :global(a),
	.course-row-item > :global(button) {
		display: flex;
	}
	.course-row {
		scrollbar-width: thin;
		scrollbar-color: rgb(var(--color-content-secondary) / 0.4) transparent;
	}
</style>
