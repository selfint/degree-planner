<script lang="ts">
	import Progress from '$lib/components/Progress.svelte';
	import RequirementElement from './RequirementElement.svelte';

	export let degreeProgress: Promise<DegreeProgress>;

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
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

		{#each degreeProgress.requirements as [name, [requirement, progress]]}
			<div class="flex flex-col space-y-2 pl-2">
				<RequirementElement requirementName={name} {requirement} {progress} />
			</div>
		{/each}
	{:catch error}
		<div class="text-content-secondary">Error: {error.message}</div>
	{/await}
</div>
