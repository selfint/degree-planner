<script lang="ts">
	export let value: number;
	export let max: number;
	export let color: string | undefined = undefined;

	let p = Math.floor((value / max) * 100);
</script>

<div class="h-4 w-56 rounded-md bg-card-primary">
	{#if color === undefined}
		<div
			id="prg"
			style="width: {p}%;"
			class="h-4 rounded-md bg-accent-primary"
		/>
	{:else}
		<div
			id="prg"
			style="width: {p}%; background: {color}"
			class="h-4 rounded-md"
		/>
	{/if}
</div>
