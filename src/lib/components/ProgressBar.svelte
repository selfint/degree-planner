<script lang="ts">
	import { content } from '$lib/preferences.svelte';
	type Props = {
		value: number;
		value2: number;
		max: number;
		color?: string;
		dir: 'ltr' | 'rtl';
	};

	let { value, value2, max, color, dir }: Props = $props();

	const effectiveMax = $derived(max === 0 ? value2 : max);

	const p1 = $derived(
		effectiveMax > 0
			? Math.max(0, Math.min(100, Math.floor((value / effectiveMax) * 100)))
			: 0
	);
	const p2 = $derived(
		value2 === undefined
			? undefined
			: effectiveMax > 0
				? Math.max(0, Math.min(100, Math.floor((value2 / effectiveMax) * 100)))
				: 0
	);
</script>

<div
	{dir}
	class="progress-track"
	role="meter"
	aria-label={content.lang.header.progress}
	aria-valuemin={0}
	aria-valuemax={effectiveMax || 1}
	aria-valuenow={Math.min(effectiveMax, Math.max(0, value))}
>
	{#if p2 !== undefined}<div
			style="width: {p2}%;"
			class="progress-planned"
		></div>{/if}
	<div
		style:width="{p1}%"
		style:background={color}
		class="progress-complete"
	></div>
</div>

<style>
	.progress-track {
		position: relative;
		block-size: 0.5rem;
		inline-size: 100%;
		overflow: hidden;
		border-radius: 999rem;
		background: rgb(var(--color-card-secondary) / 0.35);
	}
	.progress-planned,
	.progress-complete {
		position: absolute;
		inset-block: 0;
		inset-inline-start: 0;
		border-radius: inherit;
		transition: width 180ms ease;
	}
	.progress-planned {
		background: rgb(var(--color-accent-primary) / 0.25);
	}
	.progress-complete {
		background: rgb(var(--color-accent-primary));
	}
	@media (prefers-reduced-motion: reduce) {
		.progress-planned,
		.progress-complete {
			transition: none;
		}
	}
</style>
