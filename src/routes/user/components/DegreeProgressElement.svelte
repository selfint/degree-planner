<script lang="ts">
	import Progress from '$lib/components/Progress.svelte';
	import ProgressElement from './ProgressElement.svelte';

	export let degreeProgress: Promise<DegreeProgress>;
</script>

<div class="flex flex-col space-y-3">
	<h2 class="text-xl font-medium text-content-primary">Requirements</h2>
	{#await degreeProgress}
		<div class="text-content-secondary">Loading...</div>
	{:then degreeProgress}
		<div class="flex flex-row items-center space-x-2 text-content-secondary">
			<span>Points</span>
			<Progress
				value={degreeProgress.points[0]}
				max={degreeProgress.points[1]}
			/>
			<span>{degreeProgress.points[0]} / {degreeProgress.points[1]}</span>
		</div>

		{#each degreeProgress.requirements as [requirementName, [requirement, progress]]}
			<div class="flex flex-col space-y-2 pl-2">
				<ProgressElement {requirementName} {requirement} {progress} />
			</div>
		{/each}
	{/await}
</div>
