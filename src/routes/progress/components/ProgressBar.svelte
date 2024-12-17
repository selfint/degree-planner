<script lang="ts">
	type Props = {
		value: number;
		value2: number;
		max: number;
		color?: string;
		dir: 'ltr' | 'rtl';
	};

	let { value, value2, max, color, dir }: Props = $props();

	if (max === 0) {
		max = value2;
	}

	const p1 = $derived(Math.min(100, Math.floor((value / max) * 100)));
	const p2 = $derived(
		value2 === undefined
			? undefined
			: Math.min(100, Math.floor((value2 / max) * 100))
	);
</script>

<div
	{dir}
	class="h-4 w-full rounded-md bg-card-primary"
	style="position: relative;"
>
	{#if p2 !== undefined}
		<div style="width: {p2}%;" class="h-4 rounded-md bg-card-secondary"></div>
	{/if}

	{#if color === undefined}
		<div
			style="width: {p1}%;"
			class="absolute start-0 top-0 h-4 rounded-md bg-accent-primary"
		></div>
	{:else}
		<div
			style="width: {p1}%; background: {color}; "
			class="absolute start-0 top-0 h-4 rounded-md bg-accent-primary"
		></div>
	{/if}
</div>
