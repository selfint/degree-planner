<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		class?: string;
	};

	let { children, class: className = '' }: Props = $props();
</script>

<div
	class="w-[clamp(10rem,42vw,13.75rem)] min-w-[10rem] max-w-[13.75rem] sm:w-[13.75rem] sm:min-w-[13.75rem] {className}"
>
	{@render children()}
</div>
