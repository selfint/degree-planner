<script lang="ts">
	import { generateColor } from '$lib/colors';
	import Progress from '$lib/components/Progress.svelte';

	export let requirementName: string;
	export let requirement: Requirement;
	export let progress: RequirementProgress;

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	const color = generateColor(requirementName);
</script>

<h3
	class="w-fit rounded-md pl-2 pr-2 text-content-primary"
	style="background: {color}"
>
	{formatName(requirementName)}
</h3>
<div class="flex flex-col space-y-1 pl-2">
	{#if requirement.points !== undefined && progress.points !== undefined}
		<div class="flex flex-row items-center space-x-2 text-content-secondary">
			<span>Points</span>
			<Progress {color} value={progress.points} max={requirement.points} />
			<span>{progress.points} / {requirement.points}</span>
		</div>
	{/if}

	{#if requirement.count !== undefined && progress.count !== undefined}
		<div class="flex flex-row items-center space-x-2 text-content-secondary">
			<span>Count</span>
			<Progress {color} value={progress.count} max={requirement.count} />
			<span>{progress.count} / {requirement.count}</span>
		</div>
	{/if}

	{#if progress.choice !== undefined}
		<h3 class="text-content-primary">
			Choose {progress.choice.amount} / {requirement.choice?.amount}
		</h3>
		<div class="flex flex-col space-y-1 pl-2">
			{#each progress.choice.options as [name, [subRequirement, subProgress]]}
				<svelte:self
					requirementName={name}
					requirement={subRequirement}
					progress={subProgress}
				/>
			{/each}
		</div>
	{/if}
</div>
