<script lang="ts">
	import { semesters, getCourseData, degreeData } from '$lib/stores';

	import Course from '$lib/components/Course.svelte';
	import { getCourseLists } from '$lib/requirements';
</script>

<div class="flex flex-row space-x-4">
	{#each $semesters as semester}
		<div class="flex flex-col space-y-2">
			{#each semester as code}
				{#await getCourseData(code) then data}
					<Course
						{code}
						{data}
						lists={$degreeData?.then((d) =>
							getCourseLists(d.requirements, code)
						)}
					/>
				{/await}
			{/each}
		</div>
	{/each}
</div>
