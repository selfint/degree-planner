<script lang="ts">
	import ProgressElement from './ProgressElement.svelte';

	import { content } from '$lib/stores.svelte';

	type Props = {
		degreeRequirements: Requirement;
		current: Progress;
		planned: Progress;
	};

	const { degreeRequirements, current, planned }: Props = $props();
</script>

<h2 class="mb-1 ms-3 text-lg font-medium text-content-primary">
	{content.lang.progress.requirements}
</h2>
<ProgressElement indent={1} {degreeRequirements} {current} {planned} />
