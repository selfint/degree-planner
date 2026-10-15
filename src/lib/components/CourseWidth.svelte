<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		class?: string;
	};

	let { children, class: className = '' }: Props = $props();
</script>

<div class="w-[29vw] min-w-[29vw] max-w-[220px] sm:min-w-[220px] {className}">
	{@render children()}
</div>
