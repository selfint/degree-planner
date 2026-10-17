<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		variant: 'primary' | 'secondary';
		onclick: () => void;
		children: Snippet;
		disabled?: boolean;
	};

	let { variant, onclick, children, disabled = false }: Props = $props();
</script>

<button
	{disabled}
	type="button"
	class="ui-button ui-button--{variant}"
	{onclick}
>
	{@render children()}
</button>
