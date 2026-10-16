<script lang="ts">
	import type { Snippet } from 'svelte';
	import AsyncButton from './AsyncButton.svelte';
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
	};

	let {
		variant,
		onclick,
		children,
		buttonNamespace = $bindable(),
		name,
		disabled = false
	}: Props = $props();

	async function runAction() {
		if (!isPlanWritable()) return;
		try {
			await onclick?.();
		} catch (error) {
			// A disconnect can occur while preparing a write. The shared offline
			// banner explains the rejected action; do not queue it for reconnect.
			if (!(error instanceof OfflinePlanWriteError)) throw error;
		}
	}
</script>

<AsyncButton
	{variant}
	onclick={runAction}
	bind:buttonNamespace
	{name}
	disabled={disabled || !$planOnline}
>
	{@render children()}
</AsyncButton>
