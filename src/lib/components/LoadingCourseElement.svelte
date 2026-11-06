<script lang="ts">
	import CourseWidth from './CourseWidth.svelte';
	import { content } from '$lib/stores.svelte';
	import type { Snippet } from 'svelte';

	type Props = { squeeze?: boolean; note?: Snippet };
	let { note, squeeze = false }: Props = $props();
</script>

<div
	class="loading-course h-fit w-fit"
	aria-busy="true"
	aria-label={content.lang.common.loading}
>
	<CourseWidth>
		<div class="loading-body" class:squeezed={squeeze}>
			<div class="flex items-center justify-between gap-2">
				<span class="skeleton marker" aria-hidden="true"></span>
				{#if note !== undefined}<span class="text-xs text-content-secondary"
						>{@render note()}</span
					>{/if}
				<span class="skeleton metric" aria-hidden="true"></span>
			</div>
			<div class="grid gap-2" aria-hidden="true">
				<span class="skeleton"></span><span class="skeleton w-3/4"></span>
			</div>
			<span class="skeleton code" aria-hidden="true"></span>
		</div>
	</CourseWidth>
</div>

<style>
	.loading-course {
		border-radius: var(--radius-card, 0.875rem);
		background: rgb(var(--color-card-primary));
		box-shadow:
			inset 0 0 0 0.0625rem rgb(var(--color-border)),
			var(--shadow-card, 0 0.125rem 0.5rem rgb(0 0 0 / 0.06));
	}
	.loading-body {
		display: flex;
		min-block-size: 6.5rem;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.625rem;
	}
	.squeezed {
		min-block-size: 5rem;
	}
	.skeleton {
		display: block;
		block-size: 0.625rem;
		border-radius: 0.25rem;
		background: rgb(var(--color-content-secondary) / 0.15);
		animation: pulse 1.8s ease-in-out infinite;
	}
	.marker {
		inline-size: 0.625rem;
	}
	.metric {
		inline-size: 2.5rem;
	}
	.code {
		inline-size: 4rem;
		block-size: 0.5rem;
	}
	@keyframes pulse {
		50% {
			opacity: 0.4;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
		}
	}
</style>
