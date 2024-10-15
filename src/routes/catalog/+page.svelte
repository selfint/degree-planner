<script lang="ts">
	import CourseRow from './components/CourseRow.svelte';

	import { user } from '$lib/stores.svelte';
	import {
		getDegreeRequirementCourses,
		loadDegreeData
	} from '$lib/requirements';

	const degreeRequirements = $derived.by(() => {
		if (user.degree === undefined) {
			return undefined;
		}

		const data = loadDegreeData(user.degree);
		return data.then((d) => d.requirements);
	});

	const lists = $derived.by(async () => {
		if (user.degree === undefined) {
			return [];
		}

		const data = await loadDegreeData(user.degree);
		return getDegreeRequirementCourses(data.requirements);
	});
</script>

<div class="m-3 mr-0">
	<CourseRow
		colorize={false}
		titles={['Wish list']}
		codes={user.wishlist}
		{degreeRequirements}
	/>
	{#await lists}
		<div class="text-content-secondary">Loading...</div>
	{:then lists}
		{#each lists as list}
			{#if list.courses.length > 0}
				<CourseRow
					titles={list.path}
					codes={list.courses}
					{degreeRequirements}
				/>
			{/if}
		{/each}
	{/await}
</div>
