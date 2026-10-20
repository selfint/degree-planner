<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		class?: string;
	};

	let { children, class: className = '' }: Props = $props();
</script>

<div class="course-width {className}">
	{@render children()}
</div>

<style>
	.course-width {
		/* Three complete mobile columns and a visible fourth invite rail scrolling. */
		inline-size: calc((100vw - 2.5rem) / 3.25);
		flex-shrink: 0;
	}
	@media (min-width: 40rem) {
		.course-width {
			inline-size: 10.5rem;
		}
	}
</style>
