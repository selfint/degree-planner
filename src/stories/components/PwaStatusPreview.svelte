<script lang="ts">
	import AppFooter from '$lib/components/AppFooter.svelte';
	import { content } from '$lib/preferences.svelte';
	import { pwaMessages } from '$lib/pwa/messages';
	import TitleBar from '../../routes/components/TitleBar.svelte';
	import PwaUpdateBanner from '$lib/components/PwaUpdateBanner.svelte';
	import PwaStatusView from '$lib/components/PwaStatusView.svelte';
	import PwaStatusDetails from '$lib/components/PwaStatusDetails.svelte';
	import { setOfflinePublicData } from '../../../.storybook/mocks/offlineData';
	import {
		publishOfflineShellStatus,
		offlineDetailsOpen
	} from '../../../.storybook/mocks/pwaStatus';
	let {
		state: variant = 'preparing',
		offline: fixtureOffline = false,
		updateVersion: fixtureVersion = 'storybook-update-v2',
		updateVersionError,
		width,
		showErrorDetails = false
	}: {
		state?: string;
		offline?: boolean;
		updateVersion?: string;
		updateVersionError?: string;
		width?: number;
		showErrorDetails?: boolean;
	} = $props();
	const refreshFailed = $derived(variant.startsWith('refresh'));
	const allReady = $derived(
		variant.startsWith('update') ||
			[
				'ready',
				'offline',
				'offlineUpdate',
				'update',
				'refresh',
				'refreshUpdate'
			].includes(variant)
	);
	const shellUnavailable = $derived(
		['refreshShellUnavailable', 'shellUnavailable'].includes(variant)
	);
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
		variant.startsWith('update') ||
			['offlineUpdate', 'refreshUpdate'].includes(variant)
	);
	let retries = $state(0);
	let accepts = $state(0);
	// This wrapper is the sole owner of its memory-only fixture. A decorator
	// can rerender independently when toolbar globals change.
	$effect.pre(() => {
		retries = 0;
		accepts = 0;
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
		publishOfflineShellStatus({
			status: shell,
			updateReady,
			error: shellUnavailable ? 'verification' : undefined
		});
		offlineDetailsOpen.set(showErrorDetails);
	});
</script>

<div class="pwa-story" style:width={width ? `${width}px` : undefined}>
	<div class="w-full border-b border-border bg-background">
		<TitleBar
			started={true}
			searchQuery=""
			searchRevision={0}
			onSearch={() => {}}
		/>
	</div>
	<PwaUpdateBanner
		visible={updateReady}
		updateVersion={updateReady ? fixtureVersion : undefined}
		{updateVersionError}
		persistDismissal={false}
		updateBlocked={variant === 'updateDirty' || variant === 'updateSaving'}
		updateBusy={variant === 'updateApplying'}
		updateActionError={variant === 'updateOtherTabs'
			? pwaMessages[content.lang.lang].updateOtherTabs
			: undefined}
		onAccept={() => accepts++}
	/>
	<AppFooter
		compact
		persistPreferences={false}
		update={{
			status: shell,
			updateReady,
			updateVersion: updateReady ? fixtureVersion : undefined,
			updateVersionError,
			updateBlocked: variant === 'updateDirty' || variant === 'updateSaving',
			updateBusy: variant === 'updateApplying',
			updateActionError:
				variant === 'updateOtherTabs'
					? pwaMessages[content.lang.lang].updateOtherTabs
					: undefined,
			acceptUpdate: () => accepts++
		}}
	>
		{#snippet pwa()}
			<div data-testid="pwa-preview-slot" class="pwa-footer-controls">
				<PwaStatusView
					{allReady}
					offline={fixtureOffline ||
						variant === 'offline' ||
						variant === 'offlineUpdate'}
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
		{/snippet}
	</AppFooter>
</div>
{#if accepts}<output>Update requests (fixture only): {accepts}</output>{/if}
{#if retries}<output>Retry requests: {retries}</output>{/if}

<style>
	.pwa-story {
		max-inline-size: 100%;
	}
	/* Match the console's footer snippet without mounting its service lifecycle. */
	.pwa-footer-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem 0.75rem;
		min-inline-size: 0;
	}
</style>
