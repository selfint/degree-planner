<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		variant: 'primary' | 'secondary';
		children: Snippet;
	};

	let {
		variant,
		children,
		type = 'button',
		class: className = '',
		...attributes
	}: Props = $props();
</script>

<button
	{...attributes}
	{type}
	class="ui-button ui-button--{variant} {className}"
>
	{@render children()}
</button>
