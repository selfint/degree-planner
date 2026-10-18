<script lang="ts">
	import PwaStatusView from '$lib/components/PwaStatusView.svelte';
	import PwaStatusDetails from '$lib/components/PwaStatusDetails.svelte';
	import { setOfflinePublicData } from '../../../.storybook/mocks/offlineData';
	import { publishOfflineShellStatus } from '../../../.storybook/mocks/pwaStatus';
	let { state: variant = 'preparing' }: { state?: string } = $props();
	const refreshFailed = $derived(variant.startsWith('refresh'));
	const allReady = $derived(
		['ready', 'update', 'refresh', 'refreshUpdate'].includes(variant)
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

<div data-testid="pwa-preview-slot" class="flex justify-end">
	<PwaStatusView
		{allReady}
		cachedDataReady={allReady || shellUnavailable}
		{refreshError}
		{setupError}
		unavailable={variant === 'unavailable' || shellUnavailable}
		{shell}
		showPreparing={variant !== 'initial'}
		{updateReady}
		onRetry={() => retries++}
	/>
</div>
<PwaStatusDetails />
{#if retries}<output>Retry requests: {retries}</output>{/if}
