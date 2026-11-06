<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Picture } from 'imagetools-core';

	type Props = {
		title: string;
		children: Snippet;
	} & ({ src: Picture; media?: never } | { media: Snippet; src?: never });

	let { src, media, title, children }: Props = $props();
	const headingId = $props.id();
</script>

<section
	class="w-full min-w-0 sm:flex sm:max-w-[1024px] sm:flex-row"
	aria-labelledby={headingId}
>
	<div class="min-w-0 flex-1 sm:me-4">
		<div
			class="w-full rounded-[15px] border border-content-primary/30 bg-content-primary/10 p-2 bg-blend-color-burn backdrop-blur"
		>
			{#if media}
				{@render media()}
			{:else if src}
				<enhanced:img
					{src}
					alt={title}
					loading="lazy"
					class="pointer-events-auto w-full rounded-[10px] bg-transparent"
				/>
			{/if}
		</div>
	</div>
	<div class="me-3 mt-2 sm:min-w-[300px] sm:max-w-[300px] sm:flex-grow">
		<h2
			id={headingId}
			class="ms-3 text-2xl font-medium text-content-primary sm:ms-0"
		>
			{title}
		</h2>
		<p class="ms-3 text-wrap break-words text-content-secondary sm:ms-0">
			{@render children()}
		</p>
	</div>
</section>
