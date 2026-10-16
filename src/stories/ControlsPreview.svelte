<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import Select from '$lib/components/Select.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { content } from '$lib/preferences.svelte';

	let {
		disabled = false,
		loading = false,
		empty = false
	} = $props<{
		disabled?: boolean;
		loading?: boolean;
		empty?: boolean;
	}>();
	let selected = $state('winter');
	let clicks = $state(0);
	const he = $derived(content.lang.lang === 'he');
</script>

<section
	class="mx-auto flex max-w-xl flex-col gap-6 p-4"
	aria-label="Planner controls"
>
	<div>
		<h1 class="text-xl font-semibold">{he ? 'פקדים' : 'Planner controls'}</h1>
		<p class="mt-2 text-sm text-content-secondary">
			{he
				? 'נתוני הדגמה בלבד'
				: 'Demo data only. Actions stay inside this story.'}
		</p>
	</div>
	<div class="flex h-11 gap-3">
		<Button variant="primary" {disabled} onclick={() => clicks++}
			>{he ? 'הוספת סמסטר' : 'Add semester'}</Button
		>
		<Button variant="secondary" {disabled} onclick={() => (clicks = 0)}
			>{he ? 'איפוס' : 'Reset'}</Button
		>
	</div>
	<p class="text-sm text-content-secondary" aria-live="polite">
		{he ? 'סמסטרים שנוספו' : 'Semesters added'}: {clicks}
	</p>
	<label class="flex flex-col items-start gap-2">
		<span>{he ? 'סמסטר' : 'Semester'}</span>
		<Select bind:value={selected} {disabled}>
			<option value="winter">{he ? 'חורף' : 'Winter'}</option>
			<option value="spring">{he ? 'אביב' : 'Spring'}</option>
			<option value="summer">{he ? 'קיץ' : 'Summer'}</option>
		</Select>
	</label>
	<div class="flex flex-col gap-2">
		<span>{he ? 'נקודות זכות' : 'Credits'}: {empty ? 0 : 48} / 120</span>
		<ProgressBar
			value={empty ? 0 : 48}
			value2={empty ? 0 : 72}
			max={120}
			dir={content.lang.dir}
		/>
	</div>
	<div class="flex h-11 items-center gap-3">
		{#if loading}
			<div role="status" class="flex items-center gap-3">
				<div class="h-7 w-7"><Spinner /></div>
				{he ? 'טוען…' : 'Loading…'}
			</div>
		{:else}
			<AsyncButton
				variant="primary"
				{disabled}
				onclick={() => new Promise((resolve) => setTimeout(resolve, 800))}
				>{he ? 'הדגמת טעינה' : 'Try loading state'}</AsyncButton
			>
		{/if}
	</div>
</section>
