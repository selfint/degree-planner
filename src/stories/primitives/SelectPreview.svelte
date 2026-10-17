<script lang="ts">
	import Select from '$lib/components/Select.svelte';
	import { content } from '$lib/preferences.svelte';

	let {
		initialValue = '',
		disabled = false,
		emptyOptions = false
	}: {
		initialValue?: string;
		disabled?: boolean;
		emptyOptions?: boolean;
	} = $props();
	let selected = $state('');
	$effect(() => {
		selected = initialValue;
	});
	const he = $derived(content.lang.lang === 'he');
</script>

<div class="flex flex-col items-start gap-3">
	<label class="flex flex-col items-start gap-2">
		<span>{he ? 'סמסטר' : 'Semester'}</span>
		<Select bind:value={selected} {disabled}>
			<option value="">
				{emptyOptions
					? he
						? 'אין סמסטרים זמינים'
						: 'No semesters available'
					: he
						? 'בחירת סמסטר'
						: 'Choose a semester'}
			</option>
			{#if !emptyOptions}
				<option value="winter">{he ? 'חורף' : 'Winter'}</option>
				<option value="spring">{he ? 'אביב' : 'Spring'}</option>
				<option value="summer">{he ? 'קיץ' : 'Summer'}</option>
			{/if}
		</Select>
	</label>
	<p class="text-sm text-content-secondary" aria-live="polite">
		{he ? 'ערך נבחר' : 'Selected value'}: {selected || (he ? 'ללא' : 'None')}
	</p>
</div>
