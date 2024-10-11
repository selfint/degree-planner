<script lang="ts">
	import { generateColor } from '$lib/colors';
	import Progress from '$lib/components/Progress.svelte';

	export let requirementName: string;
	export let requirement: Requirement;
	export let current: RequirementProgress | undefined;
	export let planned: RequirementProgress;

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
	{#if requirement.points !== undefined && planned.points !== undefined}
		<div class="flex flex-row items-center space-x-2 text-content-secondary">
			<span>Points</span>
			<Progress
				{color}
				value={current?.points}
				value2={planned.points}
				max={requirement.points}
			/>
			<span class="text-nowrap">
				<span style="color: {color}">{current?.points ?? 0}</span>
				/ {planned.points}
				/ {requirement.points}
			</span>
		</div>
	{/if}

	{#if requirement.count !== undefined && planned.count !== undefined}
		<div class="flex flex-row items-center space-x-2 text-content-secondary">
			<span>Count</span>
			<Progress
				{color}
				value={current?.count}
				value2={planned.count}
				max={requirement.count}
			/>
			<span class="text-nowrap">
				<span style="color: {color}">{current?.count ?? 0}</span> / {planned.count}
				/ {requirement.count}</span
			>
		</div>
	{/if}

	{#if planned.choice !== undefined}
		<h3 class="text-content-primary">
			Choose {planned.choice.amount} / {requirement.choice?.amount}
		</h3>
		<div class="flex flex-col space-y-1 pl-2">
			{#each planned.choice.options as [name, [subRequirement, subProgress]]}
				<svelte:self
					requirementName={name}
					requirement={subRequirement}
					current={current?.choice?.options.get(name)?.[1]}
					planned={subProgress}
				/>
			{/each}
		</div>
	{/if}
</div>
