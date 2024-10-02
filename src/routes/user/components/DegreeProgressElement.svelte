<script lang="ts">
	import Progress from '$lib/components/Progress.svelte';
	import ProgressElement from './ProgressElement.svelte';

	export let current: DegreeProgress;
	export let planned: DegreeProgress;
</script>

<div class="flex flex-col space-y-3">
	<h2 class="text-lg font-medium text-content-primary">Requirements</h2>
	<div
		class="flex flex-row items-center space-x-2 text-base text-content-secondary"
	>
		<span>Points</span>
		<Progress
			value={current.points[0]}
			value2={planned.points[0]}
			max={planned.points[1]}
		/>
		<span>
			<span class="text-accent-primary">{current?.points[0] ?? 0}</span> / {planned
				.points[0]}
			/ {planned.points[1]}
		</span>
	</div>

	{#each planned.requirements as [requirementName, [requirement, progress]]}
		<div class="flex flex-col space-y-2 pl-2">
			<ProgressElement
				{requirementName}
				{requirement}
				current={current.requirements.get(requirementName)?.[1]}
				planned={progress}
			/>
		</div>
	{/each}
</div>
