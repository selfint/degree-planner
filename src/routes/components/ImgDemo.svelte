<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Picture } from 'imagetools-core';

	type Props = {
		src: Picture;
		title: string;
		children: Snippet;
	};

	let { src, title, children }: Props = $props();
</script>

<div class="sm:flex sm:max-w-[1024px] sm:flex-row">
	<div class="flex-grow sm:me-4">
		<div
			class="w-full rounded-[15px] border border-white border-opacity-30 bg-white bg-opacity-10 p-2 bg-blend-color-burn backdrop-blur"
		>
			<enhanced:img
				{src}
				alt={title}
				loading="lazy"
				class="pointer-events-auto w-full rounded-[10px] bg-transparent"
			/>
		</div>
	</div>
	<div class="me-3 mt-2 sm:min-w-[300px] sm:max-w-[300px] sm:flex-grow">
		<h2 class="ms-3 text-2xl font-medium text-content-primary sm:ms-0">
			{title}
		</h2>
		<p class="ms-3 text-wrap break-words text-content-secondary sm:ms-0">
			{@render children()}
		</p>
	</div>
</div>
