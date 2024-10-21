<script lang="ts">
	import type { Snippet } from 'svelte';

	import { getCourseData } from '$lib/courseData';

	type Props = {
		courses: string[] | Course[];
		indent?: number;
		children: Snippet<[{ course: Course; index: number }]>;
	};

	let { courses, indent = 1, children }: Props = $props();

	const offset = `${indent * 0.75}rem`;
	const margin = $derived(`margin-inline-end: ${offset}`);

	const _courses = $derived(
		courses.map((c) => {
			if (typeof c === 'string') {
				return getCourseData(c);
			}

			return c;
		})
	);
</script>

<div class="flex flex-row overflow-x-auto">
	<div style={margin}></div>
	{#each _courses as course, index}
		<div class="pe-2">
			{@render children({ course, index })}
		</div>
	{/each}
</div>
