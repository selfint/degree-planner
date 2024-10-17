<script lang="ts">
	import manifest from '$lib/assets/manifest.json';

	import Button from '$lib/components/Button.svelte';
	import Select from '$lib/components/Select.svelte';

	import { user } from '$lib/stores.svelte';
	import { cms } from '$lib/content';

	const lang = cms.en;

	type Props = {
		degree?: Degree;
		onChange: (degree: Degree) => boolean;
	};

	let { degree, onChange }: Props = $props();

	let years: string[] = Object.keys(manifest);

	type PartialDegree =
		| [undefined, undefined, undefined]
		| [string, undefined, undefined]
		| [string, string, undefined]
		| [string, string, string];

	let [year, faculty, path]: PartialDegree = $state(
		degree ?? [undefined, undefined, undefined]
	);

	const faculties = $derived(
		year === undefined
			? undefined
			: // @ts-expect-error
				Object.keys(manifest[year])
	);

	const paths = $derived(
		// @ts-expect-error
		faculty === undefined ? undefined : Object.keys(manifest[year][faculty])
	);

	$effect(() => {
		if (path !== undefined && !paths?.includes(path)) {
			path = undefined;
		}

		if (year === undefined) {
			year = years[0];
		}
	});

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

	const shareLink = $derived.by(() => {
		if (degree === undefined) {
			return undefined;
		}

		const [year, faculty, path] = degree;

		const semesters = user.semesters.map((s) => s.join(',')).join(';');

		return `/preview/${year}/${faculty}/${path}?semesters=${semesters}`;
	});
</script>

<div>
	<h2 class="text-lg font-medium text-content-primary">
		{lang.progress.degree}

		{#if shareLink !== undefined}
			<a href={shareLink} target="_blank" class="text-content-secondary">
				({lang.progress.share})
			</a>
		{/if}
	</h2>
	<div class="space-y-1">
		<div>
			<span class="text-content-secondary"> {lang.progress.year}: </span>
			<Select bind:value={year}>
				{#if year === undefined}
					<option value={undefined}>{lang.progress.selectYear}</option>
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
				<span class="text-content-secondary"> {lang.progress.faculty}: </span>
				<Select bind:value={faculty}>
					{#if degree === undefined && faculty === undefined}
						<option value={undefined}>{lang.progress.selectFaculty}</option>
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
				<span class="text-content-secondary"> {lang.progress.path}: </span>
				<Select bind:value={path}>
					{#if degree === undefined && path === undefined}
						<option value={undefined}>{lang.progress.selectPath}</option>
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
							onmousedown={() => {
								// @ts-expect-error We validated the choice in `choiceIsValid`
								const didChange = onChange([year, faculty, path]);

								if (!didChange) {
									reset();
								}
							}}
						>
							{lang.progress.save}
						</Button>
					</div>
				{/if}
				<div class="w-fit">
					<Button variant="secondary" onmousedown={reset}>
						{lang.progress.cancel}
					</Button>
				</div>
			</div>
		{/if}
	</div>
</div>
