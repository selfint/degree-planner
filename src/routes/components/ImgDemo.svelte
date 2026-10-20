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

<!-- Preserve the existing feature grid for either a lazy image or native media. -->
<section
	class="grid w-full min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_17rem] md:items-center md:gap-10"
	aria-labelledby={headingId}
>
	<div class="min-w-0 md:order-2">
		<h2
			id={headingId}
			class="text-2xl font-semibold leading-snug tracking-tight text-content-primary"
		>
			{title}
		</h2>
		<p class="mt-3 text-base leading-relaxed text-content-secondary">
			{@render children()}
		</p>
	</div>
	<div class="min-w-0 md:order-1">
		<div
			class="w-full rounded-2xl border border-border bg-card-primary/80 p-2 shadow-sm"
		>
			{#if media}
				{@render media()}
			{:else if src}
				<enhanced:img
					{src}
					alt={title}
					loading="lazy"
					style:aspect-ratio={`${src.img.w} / ${src.img.h}`}
					class="pointer-events-auto h-auto w-full rounded-lg bg-transparent"
				/>
			{/if}
		</div>
	</div>
</section>
