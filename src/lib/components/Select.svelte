<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	type Props = {
		value: T;
		children: Snippet;
		onchange?: (newValue: T) => void;
		disabled?: boolean;
	};

	let {
		value = $bindable(),
		children,
		onchange,
		disabled = false
	}: Props = $props();
</script>

<select
	{disabled}
	bind:value
	class="w-full max-w-fit rounded-md border border-border bg-background p-1 text-content-secondary outline-none"
	onchange={() => onchange?.(value)}
>
	{@render children()}
</select>
