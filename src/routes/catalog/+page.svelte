<script lang="ts">
	import CourseRow from './components/CourseRow.svelte';

	import { user, degreeData, content } from '$lib/stores.svelte';
	import { getDegreeRequirementCourses } from '$lib/requirements';

	const requirements = $derived(degreeData()?.requirements);

	const lists = $derived.by(() => {
		if (requirements === undefined) {
			return [];
		}

		return getDegreeRequirementCourses(requirements);
	});
</script>

<div class="mt-3">
	<CourseRow
		colorize={false}
		titles={[content.lang.catalog.wishlist]}
		codes={user.wishlist}
		{requirements}
	/>
	{#each lists as list}
		{#if list.courses.length > 0}
			<CourseRow titles={list.path} codes={list.courses} {requirements} />
		{/if}
	{/each}
</div>
