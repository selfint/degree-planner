<script lang="ts">
	type Props = {
		value: number;
		value2?: number;
		max: number;
		color?: string;
	};

	let { value, value2, max, color }: Props = $props();

	const p1 = $derived(Math.min(100, Math.floor((value / max) * 100)));
	const p2 = $derived(
		value2 === undefined
			? undefined
			: Math.min(100, Math.floor((value2 / max) * 100))
	);
</script>

<div class="h-4 w-full rounded-md bg-card-primary" style="position: relative;">
	{#if p2 !== undefined}
		<div style="width: {p2}%;" class="h-4 rounded-md bg-card-secondary"></div>
	{/if}

	{#if color === undefined}
		<div
			style="width: {p1}%; position: absolute; top: 0; left: 0;"
			class="h-4 rounded-md bg-accent-primary"
		></div>
	{:else}
		<div
			style="width: {p1}%; background: {color}; position: absolute; top: 0; left: 0;"
			class="h-4 rounded-md"
		></div>
	{/if}
</div>
