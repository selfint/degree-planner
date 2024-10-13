<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
	};

	let { children }: Props = $props();
</script>

<div class="w-[29vw] min-w-[29vw] max-w-[220px] sm:min-w-[220px]">
	{@render children()}
</div>
