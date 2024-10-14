<script lang="ts">
	import CourseRow from './components/CourseRow.svelte';

	import { degreeData, wishlist } from '$lib/stores';
	import { getDegreeRequirementCourses } from '$lib/requirements';

	const lists =
		$degreeData?.then((d) => getDegreeRequirementCourses(d.requirements)) ?? [];
</script>

<div class="m-3 mr-0">
	<CourseRow colorize={false} titles={['Wish list']} codes={$wishlist} />
	{#await lists}
		<div class="text-content-secondary">Loading...</div>
	{:then lists}
		{#each lists as list}
			{#if list.courses.length > 0}
				<CourseRow titles={list.path} codes={list.courses} />
			{/if}
		{/each}
	{/await}
</div>
