<script lang="ts">
	import { onMount } from 'svelte';

	import type { Writable } from 'svelte/store';

	import Button from '$lib/components/Button.svelte';
	import Select from '$lib/components/Select.svelte';

	export let degree: Writable<Degree | undefined>;

	let year = $degree?.[0];
	let faculty = $degree?.[1];
	let path = $degree?.[2];

	let years: Promise<string[]> | undefined = undefined;
	onMount(async () => {
		years = fetch('/api/catalog').then((res) => res.json());
	});

	$: faculties =
		year === undefined ? undefined : fetch(`/api/catalog/${year}`).then((res) => res.json());

	$: paths =
		year === undefined || faculty === undefined
			? undefined
			: fetch(`/api/catalog/${year}/${faculty}`).then((res) => res.json());

	function choiceIsValid(y: string | undefined, f: string | undefined, p: string | undefined) {
		return y !== undefined && f !== undefined && p !== undefined;
	}

	function choiceIsChanged(
		y: string | undefined,
		f: string | undefined,
		p: string | undefined,
		d: Degree | undefined
	) {
		return y !== d?.[0] || f !== d?.[1] || p !== d?.[2];
	}

	function save(y: string, f: string, p: string) {
		$degree = [y, f, p];
	}

	function reset() {
		year = $degree?.[0];
		faculty = $degree?.[1];
		path = $degree?.[2];
	}
</script>

<h2 class="text-xl text-content-primary">Degree</h2>
<div>
	<Select bind:value={year}>
		{#if year === undefined}
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
	{#if year !== undefined}
		<Select bind:value={faculty}>
			{#if $degree === undefined && faculty === undefined}
				<option value={undefined}>Select a faculty</option>
			{/if}
			{#if faculties !== undefined}
				{#await faculties}
					<progress />
				{:then faculties}
					{#each faculties as faculty}
						<option value={faculty}>{faculty.replaceAll('_', ' ')}</option>
					{/each}
				{/await}
			{/if}
		</Select>
	{/if}
	{#if faculty !== undefined}
		<Select bind:value={path}>
			{#if $degree === undefined && path === undefined}
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
	{#if choiceIsChanged(year, faculty, path, $degree)}
		{#if choiceIsValid(year, faculty, path)}
			<Button
				variant="primary"
				onClick={() => {
					// @ts-expect-error We validated the choice in `choiceIsValid`
					save(year, faculty, path);
				}}>Save</Button
			>
		{/if}
		<Button variant="secondary" onClick={reset}>Cancel</Button>
	{/if}
</div>
