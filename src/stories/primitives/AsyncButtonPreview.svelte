<script lang="ts">
	import { onDestroy } from 'svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import Button from '$lib/components/Button.svelte';
	import { content } from '$lib/preferences.svelte';

	let {
		variant = 'primary',
		disabled = false,
		sharedNamespace = false
	}: {
		variant?: 'primary' | 'secondary';
		disabled?: boolean;
		sharedNamespace?: boolean;
	} = $props();
	let namespace = $state('');
	let pending = $state(false);
	let completed = $state(0);
	let finish: (() => void) | undefined;
	const he = $derived(content.lang.lang === 'he');

	async function startAction() {
		pending = true;
		await new Promise<void>((resolve) => {
			finish = resolve;
		});
		pending = false;
		completed++;
		finish = undefined;
	}

	onDestroy(() => finish?.());
</script>

<div class="flex flex-col items-start gap-3">
	<div class="flex items-center gap-3">
		<AsyncButton
			{variant}
			{disabled}
			bind:buttonNamespace={namespace}
			name={sharedNamespace ? 'save' : undefined}
			onclick={startAction}
		>
			{he ? 'שמירת תוכנית' : 'Save plan'}
		</AsyncButton>
		{#if sharedNamespace}
			<AsyncButton
				variant="secondary"
				bind:buttonNamespace={namespace}
				name="export"
				onclick={startAction}
			>
				{he ? 'ייצוא תוכנית' : 'Export plan'}
			</AsyncButton>
		{/if}
	</div>
	{#if pending}
		<Button variant="secondary" onclick={() => finish?.()}>
			{he ? 'סיום פעולת ההדגמה' : 'Complete demo action'}
		</Button>
	{/if}
	<p class="text-sm text-content-secondary" aria-live="polite">
		{#if pending}
			{he
				? 'הפעולה ממתינה לסיום ההדגמה.'
				: 'The action waits until you complete the demo.'}
		{:else}
			{he ? 'פעולות שהושלמו' : 'Completed actions'}: {completed}
		{/if}
	</p>
</div>
