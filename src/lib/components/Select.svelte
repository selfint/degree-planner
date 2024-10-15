<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		value: unknown;
		children: Snippet;
	};

	let { value = $bindable(), children }: Props = $props();
</script>

<select
	bind:value
	class="w-fit rounded-md border border-border bg-background p-1 text-content-secondary outline-none"
>
	{@render children()}
</select>
