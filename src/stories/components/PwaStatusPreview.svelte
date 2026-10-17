<script lang="ts">
	import PwaStatusView from '$lib/components/PwaStatusView.svelte';
	let { state: variant = 'preparing' }: { state?: string } = $props();
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
		allReady={variant === 'ready' || variant === 'update'}
		unavailable={variant === 'unavailable'}
		shell={variant === 'outdated'
			? 'outdated'
			: variant === 'ready' || variant === 'update'
				? 'ready'
				: 'preparing'}
		showPreparing={variant !== 'initial'}
		updateReady={variant === 'update' && !dismissed}
		onClose={() => (dismissed = true)}
		onRetry={() => retries++}
	/>
</div>
{#if retries}<output>Retry requests: {retries}</output>{/if}
