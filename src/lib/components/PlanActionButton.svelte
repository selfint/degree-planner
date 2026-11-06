<script lang="ts">
	import type { Snippet } from 'svelte';
	import AsyncButton from './AsyncButton.svelte';
	import { content } from '$lib/preferences.svelte';
	import {
		isPlanWritable,
		OfflinePlanWriteError,
		planOnline
	} from '$lib/planAccess';

	type Props = {
		variant: 'primary' | 'secondary';
		onclick?: () => Promise<void>;
		children: Snippet;
		buttonNamespace?: string;
		name?: string;
		disabled?: boolean;
		showOfflineReason?: boolean;
	};

	let {
		variant,
		onclick,
		children,
		buttonNamespace = $bindable(),
		name,
		disabled = false,
		showOfflineReason = true
	}: Props = $props();

	async function runAction() {
		if (!isPlanWritable()) return;
		try {
			await onclick?.();
		} catch (error) {
			// A disconnect can occur while preparing a write. The
			// action-local reason explains it; do not queue it for reconnect.
			if (!(error instanceof OfflinePlanWriteError)) throw error;
		}
	}
	const reasonId = $props.id();
	const reason = $derived(
		content.lang.lang === 'he'
			? 'התחברו כדי לערוך או לשמור'
			: 'Reconnect to edit or save'
	);
</script>

<span class="plan-action" title={!$planOnline ? reason : undefined}>
	<AsyncButton
		{variant}
		onclick={runAction}
		bind:buttonNamespace
		{name}
		disabled={disabled || !$planOnline}
		ariaDescribedby={!$planOnline ? reasonId : undefined}
	>
		{@render children()}
	</AsyncButton>
	{#if !$planOnline}
		<span
			id={reasonId}
			class="offline-reason"
			class:sr-only={!showOfflineReason}
			>{content.lang.lang === 'he' ? 'ללא אינטרנט' : 'Offline'}<span
				class="sr-only">. {reason}</span
			></span
		>
	{/if}
</span>

<style>
	.plan-action {
		display: inline-flex;
		flex-direction: column;
		align-items: stretch;
		vertical-align: middle;
	}
	.offline-reason {
		color: rgb(var(--color-content-secondary));
		font-size: 0.6875rem;
		line-height: 1.3;
		text-align: center;
	}
</style>
