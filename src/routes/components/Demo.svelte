<script lang="ts">
	import type { Snippet } from 'svelte';
	import Video from './Video.svelte';

	type Props = {
		src: string;
		title: string;
		children: Snippet;
	};

	let { src, title, children }: Props = $props();
</script>

<div class="sm:flex sm:max-w-[1024px] sm:flex-row">
	<div class="flex-grow sm:me-4">
		<Video {src} />
	</div>
	<div class="mt-2 sm:min-w-[300px] sm:max-w-[300px] sm:flex-grow">
		<h2 class="text-2xl font-medium text-content-primary">
			{title}
		</h2>
		<p class="text-wrap break-words text-content-secondary">
			{@render children()}
		</p>
	</div>
</div>
