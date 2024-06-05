<script lang="ts">
	import { onMount } from 'svelte';

	import type { Writable } from 'svelte/store';

	import Button from '$lib/components/Button.svelte';
	import Select from '$lib/components/Select.svelte';

	export let plan: Writable<Plan | undefined>;

	let yearChoice = $plan?.[0];
	let degreeChoice = $plan?.[1];
	let pathChoice = $plan?.[2];

	let years: Promise<string[]> | undefined = undefined;
	onMount(async () => {
		years = fetch('/api/catalog').then((res) => res.json());
	});

	$: degrees =
		yearChoice === undefined
			? undefined
			: fetch(`/api/catalog/${yearChoice}`).then((res) => res.json());

	$: paths =
		yearChoice === undefined || degreeChoice === undefined
			? undefined
			: fetch(`/api/catalog/${yearChoice}/${degreeChoice}`).then((res) => res.json());

	function save(y: string, d: string, p: string) {
		$plan = [y, d, p];
	}

	function reset() {
		yearChoice = $plan?.[0];
		degreeChoice = $plan?.[1];
		pathChoice = $plan?.[2];
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
			{#if $plan === undefined && degreeChoice === undefined}
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
	{#if degreeChoice !== undefined}
		<Select bind:value={pathChoice}>
			{#if $plan === undefined && pathChoice === undefined}
				<option value={undefined}>Select a path</option>
			{/if}
			{#if paths !== undefined}
				{#await paths}
					<progress />
				{:then paths}
					{#each paths as path}
						<option value={path}>{path.replaceAll('_', ' ')}</option>
					{/each}
				{/await}
			{/if}
		</Select>
	{/if}
	{#if (yearChoice !== $plan?.[0] || degreeChoice !== $plan?.[1]) && yearChoice !== undefined && degreeChoice !== undefined}
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
	{#if yearChoice !== $plan?.[0] || degreeChoice !== $plan?.[1]}
		<Button variant="secondary" onClick={reset}>Cancel</Button>
	{/if}
</div>
