<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';

	type Props = {
		target: string;
		children: Snippet;
	};

	let { target, children }: Props = $props();

	const border = $derived(
		'/' + target === page.url.pathname
			? 'border-b-2 border-accent-primary'
			: 'border-b-2 border-transparent'
	);
</script>

<a href="/{target}" class="{border} w-fit text-lg text-content-primary">
	{@render children()}
</a>
