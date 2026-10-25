<script lang="ts">
	import { version } from '$app/environment';
	import { content } from '$lib/preferences.svelte';
	import { pwaMessages } from '$lib/pwa/messages';
	import type { OfflineShellStatus } from '$lib/pwa/status';

	let {
		buildCommit = __PLANIT_BUILD_SHA__,
		appVersion = version,
		update
	}: {
		buildCommit?: string | null;
		appVersion?: string;
		update?: OfflineShellStatus;
	} = $props();
	const reasonId = $props.id();
	// Both identities are compiled into this app, not fetched from a newer server
	// deployment or the waiting worker. Local builds retain Kit's build identity.
	const runningVersion = $derived(buildCommit || appVersion);
	const shortVersion = $derived(
		buildCommit ? buildCommit.slice(0, 7) : appVersion
	);
	const hasUpdate = $derived(update?.updateReady && !!update.updateVersion);
	const error = $derived(
		update?.updateVersionError ?? update?.updateActionError
	);
	const blockedReason = $derived(
		hasUpdate && update?.updateBlocked
			? pwaMessages[content.lang.lang].updateBlocked
			: undefined
	);
</script>

<div class="footer-version" data-testid="footer-version">
	<span class="version-label">
		{content.lang.footer.version}
		<bdi dir="ltr" title={runningVersion} data-testid="footer-build-version"
			>{shortVersion}</bdi
		>
	</span>
	{#if hasUpdate}
		<span aria-hidden="true">·</span>
		<button
			type="button"
			class="footer-update"
			data-testid="footer-update"
			disabled={update?.updateBlocked ||
				update?.updateBusy ||
				!!update?.updateVersionError ||
				!update?.acceptUpdate}
			aria-busy={update?.updateBusy ?? false}
			aria-describedby={blockedReason || error ? reasonId : undefined}
			onclick={() => update?.acceptUpdate?.()}
			>{pwaMessages[content.lang.lang].updateAccept}</button
		>
	{/if}
</div>
{#if update?.updateReady && (blockedReason || error)}
	<div id={reasonId} class="footer-version-details">
		{#if blockedReason}<p>{blockedReason}</p>{/if}
		{#if error}<p role="alert" data-testid="footer-update-error" dir="auto">
				{error}
			</p>{/if}
	</div>
{/if}

<style>
	.footer-version {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.375rem;
		min-inline-size: 0;
	}
	.version-label {
		overflow-wrap: anywhere;
	}
	.footer-update {
		border: 0;
		padding: 0;
		background: none;
		color: inherit;
		text-underline-offset: 0.125rem;
	}
	.footer-update:not(:disabled):hover {
		color: rgb(var(--color-content-primary));
		text-decoration: underline;
	}
	.footer-update:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
	.footer-version-details {
		min-inline-size: 0;
		overflow-wrap: anywhere;
	}
	.footer-version-details p {
		margin: 0;
	}
	.footer-version-details [role='alert'] {
		color: rgb(var(--color-error));
	}
</style>
