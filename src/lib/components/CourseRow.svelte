<script lang="ts">
	import type { Snippet } from 'svelte';

	import Sortable from 'sortablejs';
	import Spinner from './Spinner.svelte';

	type Props = {
		getCourseData: GetCourseData;
		courses: string[] | Course[];
		indent?: number;
		children: Snippet<[{ course: Course; index: number }]>;
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

	const _courses = $derived.by(async () => {
		let courseData = await Promise.all(
			courses.map(async (c) => {
				if (typeof c === 'string') {
					return await getCourseData(c);
				}

				return c;
			})
		);

		if (sortable === undefined) {
			courseData = courseData.toSorted((a, b) => {
				const medians = (b.median ?? 0) - (a.median ?? 0);

				if (medians !== 0) {
					return medians;
				}

				return (a.code ?? '').localeCompare(b.code ?? '');
			});
		}

		return courseData;
	});

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
	{#await _courses}
		{#each Array(4) as _, i}
			<div
				role="none"
				onclick={(e) => {
					e.stopPropagation();
					e.preventDefault();
				}}
				class="animate-wave pointer-events-none flex pe-2"
				style="animation-delay: {i * 120}ms"
			>
				{@render children({
					course: { code: ' '.repeat(i * i) },
					index: i
				})}
			</div>
		{/each}
	{:then _courses}
		{#each _courses as course, index}
			<div data-code={course.code} class="pe-2">
				{@render children({ course, index })}
			</div>
		{/each}
	{/await}
</div>

<style>
	@keyframes wave {
		0% {
			transform: translateY(0);
			opacity: 0.4;
		}
		30% {
			transform: translateY(-3px);
			opacity: 1;
		}
		60% {
			transform: translateY(0);
			opacity: 0.6;
		}
		100% {
			transform: translateY(0);
			opacity: 0.4;
		}
	}

	.animate-wave {
		animation: wave 1.4s ease-in-out infinite;
	}
</style>
