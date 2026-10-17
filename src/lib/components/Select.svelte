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

<span class="select-frame">
	<select
		{disabled}
		bind:value
		class="ui-field w-full max-w-full"
		onchange={() => onchange?.(value)}
	>
		{@render children()}
	</select>
</span>

<style>
	.select-frame {
		display: block;
		min-inline-size: 0;
		max-inline-size: 100%;
		/* WebKit forces native menu overflow to visible. The regular element
		   contains its closed value without changing the native option picker. */
		overflow: hidden;
		border-radius: 0.375rem;
	}
	.select-frame:has(select:focus-visible) {
		outline: 0.125rem solid rgb(var(--color-accent-primary));
		outline-offset: 0.1875rem;
	}
	select {
		display: block;
	}
	select:focus-visible {
		/* Draw the focus ring outside the containment boundary. */
		outline: none;
	}
</style>
