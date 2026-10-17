<script lang="ts">
	import PwaStatusView from '$lib/components/PwaStatusView.svelte';
	let { state: variant = 'preparing' }: { state?: string } = $props();
	const refreshFailed = $derived(variant.startsWith('refresh'));
	const allReady = $derived(
		['ready', 'update', 'refresh', 'refreshUpdate'].includes(variant)
	);
	const shellUnavailable = $derived(variant === 'refreshShellUnavailable');
	let dismissed = $state(false),
		retries = $state(0);
	$effect(() => {
		variant;
		dismissed = false;
		retries = 0;
	});
</script>

<div data-testid="pwa-preview-slot" class="flex justify-end">
	<PwaStatusView
		{allReady}
		cachedDataReady={allReady || shellUnavailable}
		refreshError={refreshFailed
			? 'Example course refresh failed: response validation rejected missing course names.'
			: undefined}
		setupError={variant === 'unavailable'
			? 'Example offline setup failed: browser storage quota exceeded.'
			: undefined}
		unavailable={variant === 'unavailable' || shellUnavailable}
		shell={variant === 'outdated'
			? 'outdated'
			: shellUnavailable
				? 'unavailable'
				: allReady
					? 'ready'
					: 'preparing'}
		showPreparing={variant !== 'initial'}
		updateReady={(variant === 'update' || variant === 'refreshUpdate') &&
			!dismissed}
		onClose={() => (dismissed = true)}
		onRetry={() => retries++}
	/>
</div>
{#if retries}<output>Retry requests: {retries}</output>{/if}
