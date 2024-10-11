<script lang="ts">
	import manifest from '$lib/assets/manifest.json';

	import Button from '$lib/components/Button.svelte';
	import Select from '$lib/components/Select.svelte';

	export let degree: Degree | undefined;
	export let onChange: (degree: Degree) => boolean;

	let years: string[] = Object.keys(manifest);

	$: [_year, _faculty, _path] = degree ?? [undefined, undefined, undefined];

	$: year = _year;
	$: faculty = _faculty;
	$: path = _path;

	// @ts-expect-error
	$: faculties = year === undefined ? undefined : Object.keys(manifest[year]);

	$: paths =
		// @ts-expect-error
		faculty === undefined ? undefined : Object.keys(manifest[year][faculty]);

	$: {
		if (path !== undefined && !paths?.includes(path)) {
			path = undefined;
		}
	}

	if (year === undefined) {
		year = years[0];
	}

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

<div>
	<h2 class="text-lg text-content-primary">Degree</h2>
	<div class="space-y-1">
		<div>
			<span class="text-content-secondary"> Year: </span>
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
		</div>

		{#if year !== undefined}
			<div>
				<span class="text-content-secondary"> Faculty: </span>
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
			</div>
		{/if}

		{#if faculty !== undefined}
			<div>
				<span class="text-content-secondary"> Path: </span>
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
			</div>
		{/if}
		{#if choiceIsChanged(year, faculty, path, degree)}
			<div class="flex flex-row">
				{#if choiceIsValid(year, faculty, path)}
					<div class="mr-2 w-fit">
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
					</div>
				{/if}
				<div class="w-fit">
					<Button variant="secondary" onClick={reset}>Cancel</Button>
				</div>
			</div>
		{/if}
	</div>
</div>
