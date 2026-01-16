<script lang="ts">
	import AsyncButton from '$lib/components/AsyncButton.svelte';

	import Button from '$lib/components/Button.svelte';
	import Select from '$lib/components/Select.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { loadRequirement } from '$lib/requirements';

	import { user, content } from '$lib/stores.svelte';

	type Props = {
		catalogs: Catalogs;
		userDegree?: Degree;
		userPath?: string;
		onChange: (degree: Degree, path?: string) => Promise<boolean>;
		onReset: () => void;
		recommended?: string[][];
		buttonNamespace: string;
	};

	let {
		catalogs,
		userDegree,
		userPath,
		onChange,
		onReset,
		recommended,
		buttonNamespace = $bindable()
	}: Props = $props();

	type Year = keyof typeof catalogs;

	let year: Year | undefined = $state(userDegree?.[0]);
	let faculty: string | undefined = $state(userDegree?.[1]);
	let degree: string | undefined = $state(userDegree?.[2]);
	let path: string | undefined = $state(userPath);

	const years = $derived(Object.keys(catalogs) as Year[]);
	const faculties = $derived(getFaculties(year));
	const degrees = $derived(getDegrees(year, faculty));

	$effect(() => {
		year = userDegree?.[0];
		faculty = userDegree?.[1];
		degree = userDegree?.[2];
		path = userPath;
	});

	function arraysEqualIgnoreOrder(a: string[], b: string[]) {
		if (a.length !== b.length) return false;
		const sortedA = [...a].sort();
		const sortedB = [...b].sort();
		return sortedA.every((value, index) => value === sortedB[index]);
	}

	const onRecommended = $derived(
		user.d.semesters.every((semester, index) =>
			arraysEqualIgnoreOrder(semester, recommended?.[index] || [])
		)
	);

	async function choiceIsValid(
		y: string | undefined,
		f: string | undefined,
		d: string | undefined,
		p: string | undefined
	): Promise<boolean> {
		let c = catalogs;

		// @ts-expect-error
		const catalog = c[y]?.[f]?.[d];
		if (catalog === undefined) {
			return false;
		}

		// @ts-expect-error
		const paths = await getPaths(y, f, d);
		if (paths.length === 0) {
			return true;
		} else {
			// @ts-expect-error
			const r = paths.map((p) => p.value).includes(p);
			return r;
		}
	}

	function choiceIsChanged(
		y: string | undefined,
		f: string | undefined,
		d: string | undefined,
		p: string | undefined,
		ud: Degree | undefined,
		up: string | undefined
	) {
		return y !== ud?.[0] || f !== ud?.[1] || d !== ud?.[2] || p !== up;
	}

	function reset() {
		year = userDegree?.[0];
		faculty = userDegree?.[1];
		degree = userDegree?.[2];
		path = userPath;
	}

	function getFaculties(year?: Year): { value: string; display: string }[] {
		if (year === undefined) {
			return [];
		}
		const c = catalogs;

		return Object.entries(c[year])
			.filter(([name]) => !['he', 'en'].includes(name))
			.map(([name, faculty]) => ({
				value: name,
				display: content.lang.lang === 'he' ? faculty.he : faculty.en
			}));
	}

	function getDegrees(
		year?: Year,
		faculty?: string
	): { value: string; display: string }[] {
		if (year === undefined || faculty === undefined) {
			return [];
		}

		let c = catalogs;

		const entries: [string, { he: string; en: string }][] = Object.entries(
			// @ts-expect-error
			c[year][faculty]
		);

		return entries
			.filter(([name]) => !['he', 'en'].includes(name))
			.map(([name, degree]) => ({
				value: name,
				display: content.lang.lang === 'he' ? degree.he : degree.en
			}));
	}

	async function getPaths(
		year: Year,
		faculty: string,
		degree: string
	): Promise<{ value: string; display: string }[]> {
		let r = await loadRequirement([year, faculty, degree] as Degree);

		return (r.nested ?? [])
			.filter(({ en }) => en.toLowerCase().includes('path'))
			.map(({ name, en, he }) => ({
				value: name,
				display: content.lang.lang === 'he' ? he : en
			}));
	}
</script>

<div class="me-3">
	<h2 class="flex flex-row gap-x-1 text-base font-medium text-content-primary">
		{content.lang.settings.degree}
	</h2>
	<div
		class="grid w-fit max-w-full grid-cols-[auto_auto] items-baseline gap-x-2 gap-y-1"
	>
		<span class="text-content-secondary">
			{content.lang.settings.year}
		</span>
		<Select
			bind:value={year}
			onchange={() => {
				faculty = undefined;
				degree = undefined;
				path = undefined;
			}}
		>
			<option value={undefined} disabled
				>{content.lang.settings.selectYear}</option
			>
			{#each years as yearSemester}
				{@const [year, semester] = yearSemester.split('_')}
				<option value={yearSemester}>
					{year}
					{content.lang.common.seasons[parseInt(semester) - 200]}
				</option>
			{/each}
		</Select>

		<span class="text-content-secondary">
			{content.lang.settings.faculty}
		</span>
		<Select
			bind:value={faculty}
			onchange={() => {
				degree = undefined;
				path = undefined;
			}}
		>
			<option value={undefined} disabled>
				{content.lang.settings.selectFaculty}
			</option>
			{#each faculties as { display, value }}
				<option {value}>
					{display}
				</option>
			{/each}
		</Select>

		<span class="text-content-secondary">
			{content.lang.settings.degree}
		</span>
		<Select
			bind:value={degree}
			onchange={() => {
				path = undefined;
			}}
		>
			<option value={undefined} disabled>
				{content.lang.settings.selectDegree}
			</option>
			{#each degrees as { display, value }}
				<option {value}>
					{display}
				</option>
			{/each}
		</Select>

		{#if year !== undefined && faculty !== undefined && degree !== undefined}
			{#await getPaths(year, faculty, degree)}
				<span class="text-content-secondary">
					{content.lang.settings.path}
				</span>
				<div class="h-7 w-7">
					<Spinner />
				</div>
			{:then paths}
				{#if paths.length > 0}
					<span class="text-content-secondary">
						{content.lang.settings.path}
					</span>
					<Select bind:value={path}>
						<option value={undefined} disabled>
							{content.lang.settings.selectPath}
						</option>
						{#each paths as { display, value }}
							<option {value}>
								{display}
							</option>
						{/each}
					</Select>
				{/if}
			{/await}
		{/if}
	</div>
	<div class="mt-2">
		{#if choiceIsChanged(year, faculty, degree, path, userDegree, userPath)}
			<div class="flex flex-row items-center gap-x-1">
				{#await choiceIsValid(year, faculty, degree, path) then isValid}
					{#if isValid}
						<AsyncButton
							variant="primary"
							onclick={async () => {
								// @ts-expect-error We validated the choice in `choiceIsValid`
								const didChange = await onChange([year, faculty, degree], path);

								if (!didChange) {
									reset();
								}
							}}
							bind:buttonNamespace
							name="save-degree"
						>
							{content.lang.settings.save}
						</AsyncButton>
					{/if}
				{/await}
				<AsyncButton
					variant="secondary"
					onclick={async () => reset()}
					bind:buttonNamespace
					name="cancel-degree"
				>
					{content.lang.settings.cancel}
				</AsyncButton>
			</div>
		{:else if !onRecommended}
			{#if recommended !== undefined}
				<Button variant="secondary" onclick={onReset}>
					{content.lang.settings.revert}
				</Button>
			{/if}
		{/if}
	</div>
</div>
