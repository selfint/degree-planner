<script lang="ts">
	import { onMount } from 'svelte';

	import type { Writable } from 'svelte/store';

	import Button from '$lib/components/Button.svelte';
	import Select from '$lib/components/Select.svelte';

	export let degree: Writable<[string, string] | undefined>;

	let years: Promise<string[]> | undefined = undefined;
	onMount(async () => {
		years = fetch('/api/catalog').then((res) => res.json());
	});
	let yearChoice = $degree?.[0];

	$: degrees =
		yearChoice === undefined
			? undefined
			: fetch(`/api/catalog/${yearChoice}`).then((res) => res.json());
	let degreeChoice = $degree?.[1];

	function save(y: string, d: string) {
		$degree = [y, d];
	}

	function reset() {
		yearChoice = $degree?.[0];
		degreeChoice = $degree?.[1];
	}
</script>

<h2 class="text-xl text-content-primary">Degree</h2>
<div>
	<Select bind:value={yearChoice}>
		{#if yearChoice === undefined}
			<option value={undefined}>Select a year</option>
		{/if}
		{#if years !== undefined}
			{#await years}
				<progress />
			{:then years}
				{#each years as year}
					<option value={year}>{year.replaceAll('_', '/')}</option>
				{/each}
			{/await}
		{/if}
	</Select>
	{#if yearChoice !== undefined}
		<Select bind:value={degreeChoice}>
			{#if $degree === undefined && degreeChoice === undefined}
				<option value={undefined}>Select a degree</option>
			{/if}
			{#if degrees !== undefined}
				{#await degrees}
					<progress />
				{:then degrees}
					{#each degrees as degree}
						<option value={degree}>{degree.replaceAll('_', ' ')}</option>
					{/each}
				{/await}
			{/if}
		</Select>
	{/if}
	{#if (yearChoice !== $degree?.[0] || degreeChoice !== $degree?.[1]) && yearChoice !== undefined && degreeChoice !== undefined}
		<Button
			variant="primary"
			onClick={() => {
				// @ts-expect-error
				save(yearChoice, degreeChoice);
			}}
		>
			Save
		</Button>
	{/if}
	{#if yearChoice !== $degree?.[0] || degreeChoice !== $degree?.[1]}
		<Button variant="secondary" onClick={reset}>Cancel</Button>
	{/if}
</div>
