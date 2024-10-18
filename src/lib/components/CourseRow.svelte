<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		courses: Course[];
		children: Snippet<[{ course: Course; index: number }]>;
	};

	let { courses, children }: Props = $props();
</script>

<div class="flex flex-row">
	{#each courses as course, index}
		{@render children({ course, index })}
	{/each}
</div>
