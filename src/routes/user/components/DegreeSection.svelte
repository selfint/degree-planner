<script lang="ts">
	import manifest from '$lib/assets/manifest.json';

	import Button from '$lib/components/Button.svelte';
	import Select from '$lib/components/Select.svelte';

	export let degree: Degree | undefined;
	export let onChange: (degree: Degree) => boolean;

	let [year, faculty, path] = degree ?? [undefined, undefined, undefined];

	let years: string[] = Object.keys(manifest);

	// @ts-expect-error
	$: faculties = year === undefined ? undefined : Object.keys(manifest[year]);

	$: paths =
		// @ts-expect-error
		faculty === undefined ? undefined : Object.keys(manifest[year][faculty]);

	function choiceIsValid(
		y: string | undefined,
		f: string | undefined,
		p: string | undefined
	) {
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

	function reset() {
		year = degree?.[0];
		faculty = degree?.[1];
		path = degree?.[2];
	}

	function capitalizeWords(str: string) {
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
</script>

<h2 class="text-xl text-content-primary">Degree</h2>
<div>
	<Select bind:value={year}>
		{#if year === undefined}
			<option value={undefined}>Select a year</option>
		{/if}
		{#if years !== undefined}
			{#each years as year}
				<option value={year}>{year.replaceAll('_', '/')}</option>
			{/each}
		{/if}
	</Select>
	{#if year !== undefined}
		<Select bind:value={faculty}>
			{#if degree === undefined && faculty === undefined}
				<option value={undefined}>Select a faculty</option>
			{/if}
			{#if faculties !== undefined}
				{#each faculties as faculty}
					<option value={faculty}>
						{capitalizeWords(faculty.replaceAll('_', ' '))}
					</option>
				{/each}
			{/if}
		</Select>
	{/if}
	{#if faculty !== undefined}
		<Select bind:value={path}>
			{#if degree === undefined && path === undefined}
				<option value={undefined}>Select a path</option>
			{/if}
			{#if paths !== undefined}
				{#each paths as path}
					<option value={path}>
						{capitalizeWords(path.replaceAll('_', ' '))}
					</option>
				{/each}
			{/if}
		</Select>
	{/if}
	{#if choiceIsChanged(year, faculty, path, degree)}
		{#if choiceIsValid(year, faculty, path)}
			<Button
				variant="primary"
				onClick={() => {
					// @ts-expect-error We validated the choice in `choiceIsValid`
					const didChange = onChange([year, faculty, path]);

					if (!didChange) {
						reset();
					}
				}}
			>
				Save
			</Button>
		{/if}
		<Button variant="secondary" onClick={reset}>Cancel</Button>
	{/if}
</div>
