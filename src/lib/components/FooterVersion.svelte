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
	// Display the same artifact identity used by Kit, its worker and cache. The
	// commit alone cannot distinguish builds with different source/config inputs.
	const runningVersion = $derived(appVersion);
	const shortVersion = $derived(
		appVersion.replace(
			/^([a-f0-9]{40,64})(-[a-f0-9]{16})$/,
			(_, sha, suffix) => `${sha.slice(0, 7)}${suffix.slice(0, 9)}`
		)
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
		<bdi
			dir="ltr"
			title={runningVersion}
			data-build-commit={buildCommit ?? undefined}
			data-testid="footer-build-version">{shortVersion}</bdi
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
