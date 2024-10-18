<script lang="ts">
	import ProgressElement from './ProgressElement.svelte';

	import { content } from '$lib/stores.svelte';

	type Props = {
		degreeRequirements: DegreeRequirements;
		current: DegreeProgress;
		planned: DegreeProgress;
	};

	const { degreeRequirements, current, planned }: Props = $props();
</script>

<h2 class="mb-1 text-lg font-medium text-content-primary ltr:ml-3 rtl:mr-3">
	{content.lang.progress.requirements}
</h2>
<ProgressElement
	indent={1}
	{degreeRequirements}
	requirementName="general"
	requirement={{ points: planned.points[1] }}
	current={{ points: current.points[0] }}
	planned={{ points: planned.points[0] }}
/>

{#each planned.requirements as [requirementName, [requirement, progress]]}
	<ProgressElement
		indent={1}
		{degreeRequirements}
		{requirementName}
		{requirement}
		current={current.requirements.get(requirementName)?.[1]}
		planned={progress}
	/>
{/each}
