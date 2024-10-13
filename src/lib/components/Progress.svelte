<script lang="ts">
	export let value: number;
	export let value2: number | undefined = undefined;
	export let max: number;
	export let color: string | undefined = undefined;

	let p1 = Math.min(100, Math.floor((value / max) * 100));
	let p2 =
		value2 === undefined
			? undefined
			: Math.min(100, Math.floor((value2 / max) * 100));
</script>

<div class="h-4 w-56 rounded-md bg-card-primary" style="position: relative;">
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
