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

<!-- Reserve the row width before a lazy image supplies its intrinsic size. -->
<div class="w-full sm:flex sm:max-w-[64rem] sm:flex-row">
	<div class="min-w-0 flex-1 sm:me-4">
		<div
			class="w-full rounded-[0.9375rem] border border-content-primary/30 bg-content-primary/10 p-2 bg-blend-color-burn backdrop-blur"
		>
			<enhanced:img
				{src}
				alt={title}
				loading="lazy"
				style:aspect-ratio={`${src.img.w} / ${src.img.h}`}
				class="pointer-events-auto h-auto w-full rounded-[0.625rem] bg-transparent"
			/>
		</div>
	</div>
	<div class="me-3 mt-2 sm:min-w-[18.75rem] sm:max-w-[18.75rem] sm:flex-grow">
		<h2 class="ms-3 text-2xl font-medium text-content-primary sm:ms-0">
			{title}
		</h2>
		<p class="ms-3 text-wrap break-words text-content-secondary sm:ms-0">
			{@render children()}
		</p>
	</div>
</div>
