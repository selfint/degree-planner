<script lang="ts">
	import CourseRow from './components/CourseRow.svelte';

	import { user } from '$lib/stores.svelte';
	import {
		getDegreeRequirementCourses,
		loadDegreeData
	} from '$lib/requirements';

	let requirements: DegreeRequirements | undefined = $state(undefined);
	$effect(() => {
		if (user.degree !== undefined) {
			loadDegreeData(user.degree).then((d) => (requirements = d.requirements));
		}
	});

	const lists = $derived.by(() => {
		if (requirements === undefined) {
			return [];
		}

		return getDegreeRequirementCourses(requirements);
	});
</script>

<div class="m-3 mr-0">
	<CourseRow
		colorize={false}
		titles={['Wish list']}
		codes={user.wishlist}
		degreeRequirements={requirements}
	/>
	{#each lists as list}
		{#if list.courses.length > 0}
			<CourseRow
				titles={list.path}
				codes={list.courses}
				degreeRequirements={requirements}
			/>
		{/if}
	{/each}
</div>
