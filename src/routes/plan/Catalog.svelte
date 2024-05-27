<script lang="ts">
	export let courses: Course[];
	export let onClick: (course: Course) => void;
</script>

<h2 class="text-xl text-white">Catalog</h2>
{#each courses as course, i}
	{#if course.info !== undefined}
		<div
			class="{i % 2 === 0 ? 'bg-dark-500' : 'bg-dark-700'} p-1 text-sm"
			role="button"
			tabindex={i}
			on:mousedown={() => onClick(course)}
		>
			<p class="text-white">{course.info?.name}</p>
		</div>
	{/if}
{/each}
