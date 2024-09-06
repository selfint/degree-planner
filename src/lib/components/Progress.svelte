<script lang="ts">
	export let value: number | undefined;
	export let value2: number;
	export let max: number;
	export let color: string | undefined = undefined;

	let p1 =
		value === undefined ? 0 : Math.min(100, Math.floor((value / max) * 100));
	let p2 = Math.min(100, Math.floor((value2 / max) * 100));
</script>

<div class="h-4 w-56 rounded-md bg-card-primary" style="position: relative;">
	<div style="width: {p2}%;" class="h-4 rounded-md bg-card-secondary" />

	{#if color === undefined}
		<div
			style="width: {p1}%; position: absolute; top: 0; left: 0;"
			class="h-4 rounded-md bg-accent-primary"
		/>
	{:else}
		<div
			style="width: {p1}%; background: {color}; position: absolute; top: 0; left: 0;"
			class="h-4 rounded-md"
		/>
	{/if}
</div>
