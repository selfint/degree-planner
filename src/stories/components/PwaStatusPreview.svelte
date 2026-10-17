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
{#if variant === 'ready' || variant === 'initial'}<p
		class="mt-3 text-sm text-content-secondary"
	>
		{variant === 'ready'
			? 'Ready status is announced to assistive technology without adding visible chrome.'
			: 'Brief preparation is intentionally silent before the delayed notice appears.'}
	</p>{/if}
{#if retries}<output>Retry requests: {retries}</output>{/if}
