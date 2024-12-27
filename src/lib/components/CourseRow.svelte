<script lang="ts">
	import type { Snippet } from 'svelte';

	import Sortable from 'sortablejs';

	import { getCourseData } from '$lib/courseData';

	type Props = {
		courses: string[] | Course[];
		indent?: number;
		children: Snippet<[{ course: Course; index: number }]>;
		resetScroll?: boolean;
		sortable?: Sortable.Options;
	};

	let {
		courses,
		indent = 1,
		children,
		resetScroll = false,
		sortable
	}: Props = $props();

	const offset = `${indent * 0.75}rem`;
	const margin = $derived(`margin-inline-end: ${offset}`);

	const _courses = $derived(
		courses
			.map((c) => {
				if (typeof c === 'string') {
					return getCourseData(c);
				}

				return c;
			})
			.toSorted((a, b) => {
				const medians = (b.median ?? 0) - (a.median ?? 0);

				if (medians !== 0) {
					return medians;
				}

				return (a.code ?? '').localeCompare(b.code ?? '');
			})
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
	class="flex min-h-32 flex-row overflow-x-auto"
>
	<div class="margin" style={margin}></div>
	{#each _courses as course, index}
		<div data-code={course.code} class="pe-2">
			{@render children({ course, index })}
		</div>
	{/each}
</div>
