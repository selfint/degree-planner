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
