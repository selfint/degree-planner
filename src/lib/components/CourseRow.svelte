<script lang="ts">
	import type { Snippet } from 'svelte';

	import Sortable from 'sortablejs';

	type Props = {
		getCourseData: GetCourseData;
		courses: CourseCode[] | Course[];
		indent?: number;
		children: Snippet<
			[{ code: CourseCode; course: Promise<Course>; index: number }]
		>;
		resetScroll?: boolean;
		sortable?: Sortable.Options;
	};

	let {
		getCourseData,
		courses,
		indent = 1,
		children,
		resetScroll = false,
		sortable
	}: Props = $props();

	const offset = `${indent * 0.75}rem`;
	const margin = $derived(`margin-inline-end: ${offset}`);

	let _courses = $state(
		courses.map((c) => {
			if (typeof c === 'string') {
				return { code: c, course: getCourseData(c) };
			}

			return { code: c.code, course: Promise.resolve(c) };
		})
	);

	// $effect(() => {
	// 	if (sortable === undefined) {
	// 		Promise.all(_courses.map((c) => c.course)).then((courseData) => {
	// 			courseData.sort((a, b) => {
	// 				const medians = (b.median ?? 0) - (a.median ?? 0);

	// 				if (medians !== 0) {
	// 					return medians;
	// 				}

	// 				return (a.code ?? '').localeCompare(b.code ?? '');
	// 			});

	// 			_courses = courseData.map((c) => ({
	// 				code: c.code,
	// 				course: Promise.resolve(c)
	// 			}));
	// 		});
	// 	}
	// });

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
	{#each _courses as { code, course }, index}
		<div data-code={code} class="pe-2">
			{@render children({ code, course, index })}
		</div>
	{/each}
</div>
