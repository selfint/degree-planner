<script lang="ts">
	import CourseElement from './CourseElement.svelte';

	export let wishlist: Course[];
	export let onWishlistClick: (code: string, toYears: boolean) => void;

	let toYears = true;
</script>

<div class="flex flex-row items-center">
	{#if !toYears}
		<h2 class="text-xl text-white">Wishlist</h2>
		<div class="min-w-1 flex-grow"></div>
	{/if}
	<button
		class="h-7 border-2 border-dark-400 bg-teal-800 pb-1 pl-1 pr-1 text-white"
		on:mousedown|preventDefault={() => (toYears = !toYears)}
	>
		{toYears ? '<--' : '-->'}
	</button>
	{#if toYears}
		<div class="min-w-1 flex-grow"></div>
		<h2 class="text-xl text-white">Wishlist</h2>
	{/if}
</div>
{#each wishlist as course, i}
	<CourseElement {course} index={i} onClick={(c) => onWishlistClick(c.code, toYears)} />
{/each}
