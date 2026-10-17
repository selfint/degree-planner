<script lang="ts">
	import ConsoleAccountStatus from '$lib/components/ConsoleAccountStatus.svelte';
	let { state: variant = 'ready' }: { state?: string } = $props();
	let retries = $state(0),
		signOuts = $state(0);
</script>

<ConsoleAccountStatus
	readOnly={variant.startsWith('offline')}
	offline={variant.startsWith('offline')}
	authPending={variant === 'authPending'}
	cloudPlanBlocked={variant === 'accountUnavailable' ||
		variant === 'offlineAccountUnavailable'}
	onRetry={() => retries++}
	onSignOut={() => signOuts++}
/>
{#if variant === 'ready'}<p class="text-content-secondary">
		Ready accounts and guest plans need no status notice.
	</p>{/if}
{#if retries}<output>Retry requests: {retries}</output>{/if}
{#if signOuts}<output>Sign-out requests: {signOuts}</output>{/if}
