<script lang="ts">
	import { content } from '$lib/preferences.svelte';
	import { pwaMessages } from '$lib/pwa/messages';
	import type { ShellReadiness } from '$lib/pwa/shell-readiness';
	let {
		allReady,
		unavailable,
		shell,
		showPreparing,
		updateReady,
		onClose,
		onRetry
	}: {
		allReady: boolean;
		unavailable: boolean;
		shell: ShellReadiness;
		showPreparing: boolean;
		updateReady: boolean;
		onClose: () => void;
		onRetry: () => void;
	} = $props();
	const text = $derived(pwaMessages[content.lang.lang]);
	// A waiting worker and an outdated shell describe one update, not two alerts.
	const update = $derived(updateReady || shell === 'outdated');
	const needsAttention = $derived(update || (!allReady && unavailable));
	const label = $derived(
		update
			? content.lang.lang === 'he'
				? 'עדכון זמין'
				: 'Update available'
			: text.unavailable
	);
	let expanded = $state(false);
</script>

<div
	data-testid="pwa-status"
	data-state={allReady
		? 'ready'
		: shell === 'outdated'
			? 'outdated'
			: unavailable
				? 'error'
				: 'preparing'}
	class="pwa-status"
>
	<p role="status" class="sr-only start-0 top-0 m-0">
		{allReady ? text.ready : showPreparing ? text.downloading : ''}
	</p>
	{#if needsAttention}
		<details class="pwa-details" bind:open={expanded}>
			<summary aria-label={label} title={label}>
				<svg
					aria-hidden="true"
					viewBox="0 0 20 20"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<circle cx="10" cy="10" r="7.25" />
					{#if update}<path d="M6.5 10 10 6.5 13.5 10M10 6.5v7" />{:else}<path
							d="M10 5.5v5M10 13v1"
						/>{/if}
				</svg>
			</summary>
			<div class="pwa-panel">
				<p role="status" data-testid={update ? 'pwa-update' : 'pwa-incomplete'}>
					{update ? text.update : text.unavailable}
				</p>
				<div class="pwa-actions">
					{#if !update}<button
							type="button"
							class="ui-button ui-button--secondary"
							onclick={onRetry}>{text.retry}</button
						>{/if}
					<button
						type="button"
						class="ui-button ui-button--secondary"
						onclick={() => {
							expanded = false;
							onClose();
						}}
					>
						{content.lang.lang === 'he' ? 'סגירה' : 'Close'}
					</button>
				</div>
			</div>
		</details>
	{/if}
</div>

<style>
	.pwa-status {
		display: contents;
	}
	.pwa-details {
		position: relative;
		flex-shrink: 0;
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: center;
		inline-size: 2.25rem;
		block-size: 2.25rem;
		border-radius: 0.375rem;
		color: rgb(var(--color-content-secondary));
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		background: rgb(var(--color-card-primary));
		color: rgb(var(--color-content-primary));
	}
	summary svg {
		inline-size: 1.125rem;
		block-size: 1.125rem;
	}
	.pwa-panel {
		position: absolute;
		z-index: 50;
		inset-block-start: calc(100% + 0.25rem);
		inset-inline-end: 0;
		inline-size: min(17rem, calc(100vw - 2rem));
		padding: 0.625rem;
		border: 0.0625rem solid rgb(var(--color-border));
		border-radius: 0.375rem;
		background: rgb(var(--color-card-primary));
		color: rgb(var(--color-content-primary));
		box-shadow: 0 0.25rem 1rem rgb(0 0 0 / 0.15);
		font-size: 0.8125rem;
		line-height: 1.5;
	}
	.pwa-actions {
		display: flex;
		gap: 0.5rem;
		margin-block-start: 0.5rem;
	}
</style>
