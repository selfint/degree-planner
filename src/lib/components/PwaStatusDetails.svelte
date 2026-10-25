<script lang="ts">
	import { onMount } from 'svelte';
	import { content } from '$lib/preferences.svelte';
	import {
		subscribeOfflinePublicData,
		type OfflinePublicDataState
	} from '$lib/offlineData';
	import { offlineShellStatus, offlineDetailsOpen } from '$lib/pwa/status';
	import { readShellFailureReason } from '$lib/pwa/shell-failure';
	import { pwaMessages } from '$lib/pwa/messages';

	let publicData = $state<OfflinePublicDataState>({
		phase: 'idle',
		courseCount: 0
	});
	onMount(() => subscribeOfflinePublicData((state) => (publicData = state)));
	const text = $derived(pwaMessages[content.lang.lang]);
	const refreshError = $derived(publicData.refreshError);
	const setupError = $derived(publicData.error);
	const shellError = $derived($offlineShellStatus.error);
	const incomplete = $derived(
		publicData.phase === 'error' || $offlineShellStatus.status === 'unavailable'
	);
	// Source diagnostics may contain raw browser English, URLs, or server text.
	// Render only localized, bounded explanations, derived on every language change.
	const messages = $derived([
		...(refreshError && publicData.phase !== 'error'
			? [
					publicData.phase === 'ready'
						? text.cachedRefreshFailed
						: text.refreshFailed
				]
			: []),
		...(setupError || publicData.phase === 'error'
			? [text.publicDataError]
			: []),
		...(shellError || $offlineShellStatus.status === 'unavailable'
			? [text.shellErrors[readShellFailureReason(shellError)]]
			: [])
	]);
	$effect(() => {
		if (!messages.length && !incomplete) offlineDetailsOpen.set(false);
	});
</script>

{#if incomplete || messages.length}
	<section
		id="offline-status"
		data-testid="pwa-status-details"
		aria-label={text.offlineAccess}
		hidden={!$offlineDetailsOpen}
	>
		{#each messages as message, index}
			<p
				role="status"
				data-testid={index === 0 && refreshError && publicData.phase !== 'error'
					? 'pwa-refresh-error'
					: 'pwa-incomplete'}
			>
				<span class="error-detail" data-testid="pwa-error-detail"
					>{message}</span
				>
			</p>
		{/each}
	</section>
{/if}

<style>
	section {
		inline-size: 100%;
		max-inline-size: 76rem;
		min-inline-size: 0;
		margin-inline: auto;
		padding-block-start: 0.375rem;
		scroll-margin-block: 1rem;
		text-align: start;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: rgb(var(--color-content-secondary));
	}
	p {
		margin: 0;
	}
	.error-detail {
		overflow-wrap: anywhere;
	}
</style>
