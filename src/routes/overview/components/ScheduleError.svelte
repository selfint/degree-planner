<script lang="ts">
	import { getScheduleError } from '$lib/schedule';

	export let course: Course;
	export let index: number;
	export let semesters: string[][];

	const scheduleError = getScheduleError(course, semesters, index);
</script>

{#await scheduleError}
	<p class="p-2 pb-1 pt-1 text-content-secondary">Loading...</p>
{:then scheduleError}
	{#if scheduleError.dependencies.length > 0}
		<div class="p-2 pb-1 pt-1">
			<h2 class="text-base text-content-primary">Dependencies</h2>
			<div class="mb-2 space-y-2">
				{#each scheduleError.dependencies as group, i}
					{#if i !== 0}
						<p class="w-full text-center text-content-secondary">OR</p>
					{/if}
					<div class="space-y-1">
						{#each group as { course, taken }}
							<slot name="dep" {course} {taken} />
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if scheduleError.adjacencies.length > 0}
		<div class="p-2 pb-1 pt-1">
			<h2 class="text-base text-content-primary">Adjacencies</h2>
			<div class="space-y-1">
				{#each scheduleError.adjacencies as { course, taken }}
					<slot name="adj" {course} {taken} />
				{/each}
			</div>
		</div>
	{/if}
{/await}
