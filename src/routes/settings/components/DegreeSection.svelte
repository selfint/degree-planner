<script lang="ts">
	import AsyncButton from '$lib/components/AsyncButton.svelte';

	import Button from '$lib/components/Button.svelte';
	import Select from '$lib/components/Select.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	import { user, content } from '$lib/stores.svelte';

	type Props = {
		userDegree?: Degree;
		userPath?: string;
		onChange: (degree: Degree, path?: string) => Promise<boolean>;
		onReset: () => void;
		recommended?: string[][];
		buttonNamespace: string;
	};

	let {
		userDegree,
		userPath,
		onChange,
		onReset,
		recommended,
		buttonNamespace = $bindable()
	}: Props = $props();

	const catalogs = import('$lib/assets/catalogsHeader.json')
		.then((c) => c.default)
		.then(async (c) => {
			// sleep 5 seconds
			await new Promise((resolve) => setTimeout(resolve, 5000));
			return c;
		});

	type Year = keyof Awaited<typeof catalogs>;
	const years = catalogs.then((c) => Object.keys(c) as Year[]);

	let year: Year | undefined = $state(userDegree?.[0]);
	let faculty: string | undefined = $state(userDegree?.[1]);
	let degree: string | undefined = $state(userDegree?.[2]);
	let path: string | undefined = $state(userPath);

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
		let c = await catalogs;

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

	async function getFaculties(
		year: Year
	): Promise<{ value: string; display: string }[]> {
		const c = await catalogs;

		return Object.entries(c[year])
			.filter(([name]) => !['he', 'en'].includes(name))
			.map(([name, faculty]) => ({
				value: name,
				display: content.lang.lang === 'he' ? faculty.he : faculty.en
			}));
	}

	async function getDegrees(
		year: Year,
		faculty: string
	): Promise<{ value: string; display: string }[]> {
		let c = await catalogs;

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
		let c = await catalogs;

		const entries: { name: string; he: string; en: string }[] =
			// @ts-expect-error
			c[year][faculty][degree]['requirement']['nested'];

		return entries
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
		{#await catalogs}
			<div class="h-6 w-6">
				<Spinner />
			</div>
			<span class="text-content-secondary">{content.lang.common.loading}</span>
		{/await}
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
			{#await years then years}
				{#if year === undefined}
					<option value={undefined}>{content.lang.settings.selectYear}</option>
				{/if}
				{#each years as yearSemester}
					{@const [year, semester] = yearSemester.split('_')}
					<option value={yearSemester}>
						{year}
						{content.lang.common.seasons[parseInt(semester) - 200]}
					</option>
				{/each}
			{/await}
		</Select>

		{#if year !== undefined}
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
				{#await getFaculties(year) then faculties}
					{#if faculty === undefined}
						<option value={undefined}>
							{content.lang.settings.selectFaculty}
						</option>
					{/if}
					{#each faculties as { display, value }}
						<option {value}>
							{display}
						</option>
					{/each}
				{/await}
			</Select>
		{/if}

		{#if year !== undefined && faculty !== undefined}
			<span class="text-content-secondary">
				{content.lang.settings.degree}
			</span>
			<Select
				bind:value={degree}
				onchange={() => {
					path = undefined;
				}}
			>
				{#await getDegrees(year, faculty) then degrees}
					{#if degree === undefined}
						<option value={undefined}>
							{content.lang.settings.selectDegree}
						</option>
					{/if}
					{#each degrees as { display, value }}
						<option {value}>
							{display}
						</option>
					{/each}
				{/await}
			</Select>
		{/if}

		{#if year !== undefined && faculty !== undefined && degree !== undefined}
			{#await getPaths(year, faculty, degree) then paths}
				{#if paths.length > 0}
					<span class="text-content-secondary">
						{content.lang.settings.path}
					</span>
					<Select bind:value={path}>
						{#if path === undefined}
							<option value={undefined}>
								{content.lang.settings.selectPath}
							</option>
						{/if}
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
