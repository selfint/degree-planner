<script lang="ts">
	import Progress from '$lib/components/Progress.svelte';

	export let requirement: Requirement;
	export let progress: RequirementProgress;

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
</script>

<div class="flex flex-col space-y-1 pl-2">
	{#if requirement.points !== undefined}
		<div class="flex flex-row items-center space-x-2 text-content-secondary">
			<span>Points</span>
			<Progress value={progress.points} max={requirement.points} />
			<span>{progress.points} / {requirement.points}</span>
		</div>
	{/if}

	{#if requirement.count !== undefined}
		<div class="flex flex-row items-center space-x-2 text-content-secondary">
			<span>Count</span>
			<Progress value={progress.count} max={requirement.count} />
			<span>{progress.count} / {requirement.count}</span>
		</div>
	{/if}

	{#if progress.choice !== undefined}
		<h3 class="text-content-primary">
			Choose {progress.choice.amount} / {requirement.choice?.amount}
		</h3>
		<div class="flex flex-col space-y-1 pl-2">
			{#each progress.choice.options as [name, [subRequirement, subProgress]]}
				<h4 class="text-content-primary">{formatName(name)}</h4>
				<svelte:self requirement={subRequirement} progress={subProgress} />
			{/each}
		</div>
	{/if}
</div>
