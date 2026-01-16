<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		variant: 'primary' | 'secondary';
		onclick: () => void;
		children: Snippet;
	};

	let { variant, onclick, children }: Props = $props();

	const bg = $derived(
		variant === 'primary' ? 'bg-accent-primary' : 'bg-card-secondary'
	);
</script>

<button
	class="h-full rounded-md border border-transparent p-0.5 pl-3 pr-3 leading-tight {bg} text-content-primary"
	{onclick}
>
	{@render children()}
</button>
