<script lang="ts">
	import { content } from '$lib/preferences.svelte';
	import { pwaMessages } from '$lib/pwa/messages';
	import type { ShellReadiness } from '$lib/pwa/shell-readiness';
	let {
		allReady,
		offline = false,
		cachedDataReady = allReady,
		unavailable,
		shell,
		showPreparing,
		updateReady,
		refreshError,
		setupError,
		onRetry
	}: {
		allReady: boolean;
		offline?: boolean;
		cachedDataReady?: boolean;
		unavailable: boolean;
		shell: ShellReadiness;
		showPreparing: boolean;
		updateReady: boolean;
		refreshError?: string;
		setupError?: string;
		onRetry: () => void;
	} = $props();
	const text = $derived(pwaMessages[content.lang.lang]);
	const hasError = $derived(
		!!refreshError || !!setupError || (!allReady && unavailable)
	);
	const detailsLabel = $derived(
		content.lang.lang === 'he' ? 'שגיאה. הצגת פרטים' : 'Error. View details'
	);
</script>

<div
	data-testid="pwa-status"
	data-refresh-state={refreshError ? 'error' : 'idle'}
	data-state={allReady
		? 'ready'
		: shell === 'outdated'
			? 'outdated'
			: unavailable
				? 'error'
				: 'preparing'}
	class="pwa-status"
>
	<p
		role="status"
		class="readiness start-0 top-0 m-0"
		class:sr-only={hasError ||
			updateReady ||
			(allReady && !offline) ||
			(!offline && !showPreparing && shell !== 'outdated')}
	>
		{offline && !hasError
			? content.lang.lang === 'he'
				? 'אין אינטרנט'
				: 'Offline'
			: refreshError
				? cachedDataReady
					? text.cachedRefreshFailed
					: text.refreshFailed
				: shell === 'outdated'
					? text.shellOutdated
					: allReady
						? text.ready
						: showPreparing
							? text.downloading
							: ''}
	</p>
	{#if hasError}
		<div class="pwa-actions" data-testid="pwa-error">
			<a
				href="#offline-status"
				aria-label={detailsLabel}
				title={detailsLabel}
				class="status-link has-error"
				>{content.lang.lang === 'he' ? 'שגיאה' : 'Error'}</a
			>
			<button type="button" class="retry-button" onclick={onRetry}
				>{content.lang.lang === 'he' ? 'נסו שוב' : 'Retry'}</button
			>
		</div>
	{/if}
</div>

<style>
	.pwa-status {
		display: contents;
	}
	.readiness {
		font-size: 0.75rem;
		color: rgb(var(--color-content-secondary));
		white-space: nowrap;
	}
	.pwa-actions {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.25rem;
	}
	.status-link,
	.retry-button {
		display: inline-flex;
		block-size: var(--control-height);
		align-items: center;
		justify-content: center;
		padding-inline: 0.125rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		line-height: 1.4;
		white-space: nowrap;
	}
	.status-link {
		color: rgb(var(--color-content-secondary));
		text-decoration: underline;
		text-underline-offset: 0.125rem;
	}
	.status-link.has-error {
		color: rgb(var(--color-error));
	}
	.retry-button {
		border: 0.0625rem solid rgb(var(--color-border));
		padding-inline: 0.25rem;
		background: rgb(var(--color-card-primary));
		color: rgb(var(--color-content-primary));
		font-weight: 600;
	}
	.status-link:hover,
	.retry-button:hover {
		background: rgb(var(--color-card-primary));
		color: rgb(var(--color-content-primary));
	}
</style>
