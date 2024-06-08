<script lang="ts">
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
		{#each degreeProgress.requirements as [name, [requirement, progress]]}
			<div class="flex flex-col space-y-2 pl-2">
				<h3 class="text-content-primary">{formatName(name)}</h3>
				<RequirementElement {requirement} {progress} />
			</div>
		{/each}
	{:catch error}
		<div class="text-content-secondary">Error: {error.message}</div>
	{/await}
</div>
