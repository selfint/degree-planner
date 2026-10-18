<script lang="ts">
	import { onMount } from 'svelte';
	import { content } from '$lib/preferences.svelte';
	import {
		subscribeOfflinePublicData,
		type OfflinePublicDataState
	} from '$lib/offlineData';
	import { offlineShellStatus } from '$lib/pwa/status';
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
	const errors = $derived(
		[...new Set([refreshError, setupError, shellError])].filter(
			(error): error is string => !!error
		)
	);
</script>

{#if incomplete || errors.length}
	<section
		id="offline-status"
		data-testid="pwa-status-details"
		aria-labelledby="offline-status-title"
		tabindex="-1"
	>
		<h2 id="offline-status-title">
			{content.lang.lang === 'he' ? 'גישה ללא אינטרנט' : 'Offline access'}
		</h2>
		{#if refreshError && publicData.phase !== 'error'}
			<p role="status" data-testid="pwa-refresh-error">
				{publicData.phase === 'ready'
					? text.cachedRefreshFailed
					: text.refreshFailed}
			</p>
		{:else if incomplete || setupError || shellError}
			<p role="status" data-testid="pwa-incomplete">{text.unavailable}</p>
		{/if}
		{#each errors as error}
			<p class="error-detail" data-testid="pwa-error-detail" dir="auto">
				{error}
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
	h2 {
		color: rgb(var(--color-content-primary));
		font-size: 0.875rem;
		font-weight: 600;
	}
	p {
		margin-block-start: 0.375rem;
	}
	.error-detail {
		overflow-wrap: anywhere;
	}
</style>
