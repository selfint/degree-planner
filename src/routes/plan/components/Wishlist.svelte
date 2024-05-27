<script lang="ts">
	import { selectedGroup } from '../stores';

	export let wishlist: Course[];
	export let onWishlistClick: (code: string, toYears: boolean) => void;

	let toYears = true;

	function getCourseBg(code: string, index: number, group: Group | undefined) {
		if (group?.courses.some((course) => course.code === code)) {
			return 'bg-indigo-900';
		}

		return index % 2 === 0 ? 'bg-dark-500' : 'bg-dark-700';
	}
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
	{#if course.info !== undefined}
		<div
			class="{getCourseBg(course.code, i, $selectedGroup)} p-1 text-sm"
			role="button"
			tabindex={i}
			on:mousedown={() => onWishlistClick(course.code, toYears)}
		>
			<p class="text-white">{course.info.name}</p>
		</div>
	{/if}
{/each}
