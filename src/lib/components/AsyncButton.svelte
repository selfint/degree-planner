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

	const bg = $derived(
		variant === 'primary' ? 'bg-accent-primary' : 'bg-card-secondary'
	);

	let inProgress = $state(false);

	async function onclick() {
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

{#if inProgress}
	<div class="h-7 w-7">
		<Spinner />
	</div>
{:else}
	<button
		{disabled}
		class="h-full rounded-md border border-transparent p-0.5 pl-3 pr-3 leading-tight {bg} text-content-primary"
		{onclick}
		class:opacity-50={disabled}
	>
		{@render children()}
	</button>
{/if}
