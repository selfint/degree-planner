<script lang="ts">
	import CourseGroup from './components/CourseGroup.svelte';

	import { user, catalog, content } from '$lib/stores.svelte';
	import { getDegreeRequirementCourses } from '$lib/requirements';

	const requirements = $derived(catalog()?.requirement);

	const lists = $derived.by(() => {
		if (requirements === undefined) {
			return [];
		}

		return getDegreeRequirementCourses(requirements);
	});
</script>

<div class="mt-3">
	<CourseGroup
		colorize={false}
		titles={[{ name: content.lang.catalog.wishlist }]}
		codes={user.wishlist}
		{requirements}
	/>
	{#each lists as list}
		{#if list.courses.length > 0}
			<CourseGroup titles={list.path} codes={list.courses} {requirements} />
		{/if}
	{/each}
</div>
