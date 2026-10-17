<script lang="ts">
	import PlanActionButton from '$lib/components/PlanActionButton.svelte';
	let {
		variant = 'primary',
		disabled = false,
		pending = false
	}: {
		variant?: 'primary' | 'secondary';
		disabled?: boolean;
		pending?: boolean;
	} = $props();
	let count = $state(0);
</script>

<div class="flex flex-wrap items-center gap-3">
	<PlanActionButton
		{variant}
		{disabled}
		onclick={async () => {
			if (pending) await new Promise(() => {});
			count++;
		}}>Save demo plan</PlanActionButton
	>
	<output>Demo saves: {count}</output>
</div>
