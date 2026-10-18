<script lang="ts">
	import AppFooter from '$lib/components/AppFooter.svelte';
	import { content } from '$lib/preferences.svelte';
	import PwaStatusView from '$lib/components/PwaStatusView.svelte';
	import PwaStatusDetails from '$lib/components/PwaStatusDetails.svelte';
	import { setOfflinePublicData } from '../../../.storybook/mocks/offlineData';
	import { publishOfflineShellStatus } from '../../../.storybook/mocks/pwaStatus';
	let { state: variant = 'preparing' }: { state?: string } = $props();
	const refreshFailed = $derived(variant.startsWith('refresh'));
	const allReady = $derived(
		['ready', 'offline', 'update', 'refresh', 'refreshUpdate'].includes(variant)
	);
	const shellUnavailable = $derived(variant === 'refreshShellUnavailable');
	const refreshError = $derived(
		refreshFailed
			? 'Example course refresh failed: response validation rejected missing course names.'
			: undefined
	);
	const setupError = $derived(
		variant === 'unavailable'
			? 'Example offline setup failed: browser storage quota exceeded.'
			: undefined
	);
	const shell = $derived(
		variant === 'outdated'
			? 'outdated'
			: shellUnavailable
				? 'unavailable'
				: allReady
					? 'ready'
					: 'preparing'
	);
	const updateReady = $derived(
		variant === 'update' || variant === 'refreshUpdate'
	);
	let retries = $state(0);
	// This wrapper is the sole owner of its memory-only fixture. A decorator
	// can rerender independently when toolbar globals change.
	$effect.pre(() => {
		retries = 0;
		setOfflinePublicData({
			phase: setupError
				? 'error'
				: allReady || shellUnavailable
					? 'ready'
					: variant === 'initial'
						? 'idle'
						: 'loading',
			courseCount: allReady || shellUnavailable ? 3 : 0,
			error: setupError,
			refreshError
		});
		publishOfflineShellStatus({ status: shell, updateReady });
	});
</script>

<AppFooter compact persistPreferences={false}>
	{#snippet pwa()}
		<div data-testid="pwa-preview-slot" class="pwa-footer-controls">
			<PwaStatusView
				{allReady}
				offline={variant === 'offline'}
				cachedDataReady={allReady || shellUnavailable}
				{refreshError}
				{setupError}
				unavailable={variant === 'unavailable' || shellUnavailable}
				{shell}
				showPreparing={variant !== 'initial'}
				{updateReady}
				onRetry={() => retries++}
			/>
			<a
				href="/#install-title"
				target="_blank"
				rel="noopener noreferrer"
				class="pwa-install-help"
				data-testid="pwa-install-help"
				>{content.lang.lang === 'he' ? 'עזרה בהתקנה' : 'Install help'}</a
			>
		</div>
		<PwaStatusDetails />
	{/snippet}
</AppFooter>
{#if retries}<output>Retry requests: {retries}</output>{/if}

<style>
	/* Match the console's footer snippet without mounting its service lifecycle. */
	.pwa-footer-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem 0.75rem;
		min-inline-size: 0;
	}
	.pwa-install-help {
		margin-inline-start: auto;
		display: inline-flex;
		align-items: center;
		block-size: var(--control-height);
		white-space: nowrap;
		text-decoration: underline;
		text-underline-offset: 0.125rem;
		color: rgb(var(--color-content-secondary));
	}
</style>
