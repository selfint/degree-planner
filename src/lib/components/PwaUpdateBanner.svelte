<script lang="ts">
	import { onMount } from 'svelte';
	import { content } from '$lib/preferences.svelte';
	import { pwaMessages } from '$lib/pwa/messages';

	let {
		visible = false,
		updateVersion,
		updateVersionError,
		persistDismissal = true,
		updateBlocked = false,
		updateBusy = false,
		updateActionError,
		onAccept
	}: {
		visible?: boolean;
		updateVersion?: string;
		updateVersionError?: string;
		persistDismissal?: boolean;
		updateBlocked?: boolean;
		updateBusy?: boolean;
		updateActionError?: string;
		onAccept?: () => void;
	} = $props();
	const blockedReasonId = $props.id();
	const preferenceKey = 'planit-dismissed-update-version';
	let preferenceReady = $state(false);
	let dismissedVersion = $state<string | undefined>();
	let preferenceError = $state<string | undefined>();
	onMount(() => {
		if (!persistDismissal) return;
		try {
			const value = sessionStorage.getItem(preferenceKey);
			if (value === '')
				throw new Error('The dismissed update version is empty.');
			dismissedVersion = value ?? undefined;
		} catch (error) {
			preferenceError = error instanceof Error ? error.message : String(error);
		}
		preferenceReady = true;
	});
	const error = $derived(updateVersionError ?? preferenceError);
	// Wait for the actual waiting build's identity before showing a previously
	// dismissed notice again. A different build is never suppressed by that choice.
	const shown = $derived(
		visible &&
			(!persistDismissal || preferenceReady) &&
			(!!error ||
				(!dismissedVersion && !updateVersion) ||
				(!!updateVersion && updateVersion !== dismissedVersion))
	);
	function dismiss() {
		if (!updateVersion) return;
		try {
			if (persistDismissal)
				sessionStorage.setItem(preferenceKey, updateVersion);
			dismissedVersion = updateVersion;
			preferenceError = undefined;
		} catch (error) {
			preferenceError = error instanceof Error ? error.message : String(error);
		}
	}
</script>

{#if shown}
	<aside
		class="update-banner"
		data-testid="pwa-update-banner"
		data-update-version={updateVersion}
	>
		<div class="update-content">
			<div class="update-copy">
				<p role="status" data-testid="pwa-update">
					{pwaMessages[content.lang.lang].update}
				</p>
			</div>
			<button
				type="button"
				class="accept-update ui-button ui-button--secondary"
				data-testid="pwa-update-accept"
				disabled={!updateVersion || updateBlocked || updateBusy || !onAccept}
				aria-busy={updateBusy}
				aria-describedby={updateBlocked ? blockedReasonId : undefined}
				onclick={onAccept}>{pwaMessages[content.lang.lang].updateAccept}</button
			>
			<button
				type="button"
				class="dismiss-update"
				data-testid="pwa-update-dismiss"
				aria-label={pwaMessages[content.lang.lang].close}
				title={pwaMessages[content.lang.lang].close}
				disabled={!updateVersion || updateBusy}
				onclick={dismiss}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
					<path
						d="m4 4 8 8M12 4l-8 8"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
				</svg>
			</button>
			{#if error}
				<p
					class="update-error"
					role="alert"
					data-testid="pwa-update-error"
					dir="auto"
				>
					{error}
				</p>
			{/if}
			{#if updateActionError}<p
					role="alert"
					class="update-error"
					data-testid="pwa-update-action-error"
				>
					{updateActionError}
				</p>{/if}
			{#if updateBlocked}
				<p
					id={blockedReasonId}
					class="blocked-reason update-error"
					data-testid="pwa-update-blocked"
				>
					{pwaMessages[content.lang.lang].updateBlocked}
				</p>
			{/if}
		</div>
	</aside>
{/if}

<style>
	.update-banner {
		min-inline-size: 0;
		border-block-end: 0.0625rem solid rgb(var(--color-border));
		background: rgb(var(--color-accent-primary) / 0.08);
		color: rgb(var(--color-content-primary));
	}
	.update-content {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.125rem 0.5rem;
		max-inline-size: 76rem;
		margin-inline: auto;
		padding: 0.125rem 0.75rem;
	}
	.update-copy,
	.update-error {
		min-inline-size: 0;
		font-size: 0.8125rem;
		line-height: 1.4;
	}
	.update-error {
		grid-column: 1 / -1;
		color: rgb(var(--color-error));
		overflow-wrap: anywhere;
	}
	.accept-update {
		flex: none;
		white-space: nowrap;
	}
	.dismiss-update {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		inline-size: var(--control-height);
		block-size: var(--control-height);
		border-radius: 0.375rem;
		color: rgb(var(--color-content-primary));
	}
	.dismiss-update:disabled {
		opacity: 0.5;
	}
	.dismiss-update svg {
		inline-size: 1rem;
		block-size: 1rem;
	}
	@media (hover: hover) {
		.dismiss-update:not(:disabled):hover {
			background: rgb(var(--color-card-primary));
		}
	}
</style>
