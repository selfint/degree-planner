<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import { content } from '$lib/preferences.svelte';

	let {
		variant = 'primary',
		disabled = false
	}: {
		variant?: 'primary' | 'secondary';
		disabled?: boolean;
	} = $props();
	let clicks = $state(0);
	const he = $derived(content.lang.lang === 'he');
</script>

<div class="flex flex-col items-start gap-3">
	<Button {variant} {disabled} onclick={() => clicks++}>
		{he ? 'הוספת סמסטר' : 'Add semester'}
	</Button>
	<p class="text-sm text-content-secondary" aria-live="polite">
		{he ? 'סמסטרים שנוספו' : 'Semesters added'}: {clicks}
	</p>
</div>
