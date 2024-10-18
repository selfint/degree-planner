<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	type Props = {
		value: T;
		children: Snippet;
		onchange?: (newValue: T) => void;
	};

	let { value = $bindable(), children, onchange }: Props = $props();
</script>

<select
	bind:value
	class="w-fit rounded-md border border-border bg-background p-1 text-content-secondary outline-none"
	onchange={() => onchange?.(value)}
>
	{@render children()}
</select>
