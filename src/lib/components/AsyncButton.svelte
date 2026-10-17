<script lang="ts">
	import type { Snippet } from 'svelte';
	import Spinner from './Spinner.svelte';

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
		onclick: _onclick,
		children,
		buttonNamespace: namespace = $bindable(),
		name,
		disabled: _disabled = false
	}: Props = $props();

	let inProgress = $state(false);

	async function onclick() {
		if (inProgress || disabled) return;
		try {
			inProgress = true;

			if (namespace !== undefined && name !== undefined) {
				namespace = name;
			}

			await _onclick?.();
		} finally {
			inProgress = false;

			if (namespace !== undefined && name !== undefined) {
				namespace = '';
			}
		}
	}

	let disabled = $derived.by(() => {
		if (_disabled) {
			return true;
		}

		if (namespace === undefined || name === undefined) {
			return false;
		}

		if (namespace === '') {
			return false;
		}

		return namespace !== name;
	});
</script>

<button
	type="button"
	disabled={disabled || inProgress}
	aria-busy={inProgress}
	class="ui-button relative ui-button--{variant}"
	{onclick}
>
	<span class:opacity-0={inProgress}>{@render children()}</span>
	{#if inProgress}
		<span class="absolute h-4 w-4" aria-hidden="true"><Spinner /></span>
	{/if}
</button>
