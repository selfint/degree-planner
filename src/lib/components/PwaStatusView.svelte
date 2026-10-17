<script lang="ts">
	import { content } from '$lib/preferences.svelte';
	import { pwaMessages } from '$lib/pwa/messages';
	import type { ShellReadiness } from '$lib/pwa/shell-readiness';
	let {
		allReady,
		unavailable,
		shell,
		showPreparing,
		updateReady,
		onClose,
		onRetry
	}: {
		allReady: boolean;
		unavailable: boolean;
		shell: ShellReadiness;
		showPreparing: boolean;
		updateReady: boolean;
		onClose: () => void;
		onRetry: () => void;
	} = $props();
	const text = $derived(pwaMessages[content.lang.lang]);
</script>

<!-- Lifecycle stays mounted in the console. Ready state takes no visual space;
     only preparation, a failed setup, or an update needs an on-screen notice. -->
<div
	data-testid="pwa-status"
	data-state={allReady
		? 'ready'
		: shell === 'outdated'
			? 'outdated'
			: unavailable
				? 'error'
				: 'preparing'}
	class="text-sm text-content-secondary"
>
	<p role="status" class="sr-only start-0 top-0 m-0">
		{allReady ? text.ready : ''}
	</p>
	{#if updateReady}
		<div
			role="status"
			class="ui-notice flex items-start gap-3"
			data-testid="pwa-update"
		>
			<p class="flex-grow">{text.update}</p>
			<button
				type="button"
				class="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-lg hover:bg-background"
				aria-label={text.close}
				onclick={onClose}>×</button
			>
		</div>
	{/if}
	{#if !allReady}
		{#if shell === 'outdated'}
			<p role="status" class="ui-notice" data-testid="pwa-incomplete">
				{text.shellOutdated}
			</p>
		{:else if unavailable}
			<p role="status" class="ui-notice" data-testid="pwa-incomplete">
				{text.unavailable}
				<button type="button" class="ms-2 min-h-11 underline" onclick={onRetry}
					>{text.retry}</button
				>
			</p>
		{:else if showPreparing}
			<p role="status" class="ui-notice" data-testid="pwa-downloading">
				{text.downloading}
			</p>
		{/if}
	{/if}
</div>
