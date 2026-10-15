<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		variant: 'primary' | 'secondary';
		onclick: () => void;
		children: Snippet;
	};

	let { variant, onclick, children }: Props = $props();

	const bg = $derived(
		variant === 'primary'
			? 'bg-accent-primary text-content-on-accent'
			: 'bg-card-secondary text-content-primary'
	);
</script>

<button
	class="h-full rounded-md border border-transparent p-0.5 pl-3 pr-3 leading-tight {bg}"
	{onclick}
>
	{@render children()}
</button>
