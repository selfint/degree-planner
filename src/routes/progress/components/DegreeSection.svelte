<script lang="ts">
	import catalogs from '$lib/assets/catalogs.json';

	import Button from '$lib/components/Button.svelte';
	import Select from '$lib/components/Select.svelte';

	import { user, content } from '$lib/stores.svelte';

	type Props = {
		userDegree?: Degree;
		userPath?: string;
		onChange: (degree: Degree) => boolean;
		onReset: () => void;
		recommended?: string[][];
	};

	let { userDegree, userPath, onChange, onReset, recommended }: Props =
		$props();

	type Year = keyof typeof catalogs;
	const years = Object.keys(catalogs) as Year[];

	let year: Year | undefined = $state(userDegree?.[0]);
	let faculty: string | undefined = $state(userDegree?.[1]);
	let degree: string | undefined = $state(userDegree?.[2]);
	let path: string | undefined = $state(userPath);

	function arraysEqualIgnoreOrder(a: string[], b: string[]) {
		if (a.length !== b.length) return false;
		const sortedA = [...a].sort();
		const sortedB = [...b].sort();
		return sortedA.every((value, index) => value === sortedB[index]);
	}

	const onRecommended = $derived(
		user.semesters.every((semester, index) =>
			arraysEqualIgnoreOrder(semester, recommended?.[index] || [])
		)
	);

	$effect(() => {
		if (year === undefined) {
			year = years[0];
		}
	});

	function choiceIsValid(
		y: string | undefined,
		f: string | undefined,
		p: string | undefined
	) {
		// @ts-expect-error
		return catalogs[y]?.[f]?.[p] !== undefined;
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
		year = userDegree?.[0];
		faculty = userDegree?.[1];
		degree = userDegree?.[2];
	}

	const shareLink = $derived.by(() => {
		if (userDegree === undefined) {
			return undefined;
		}

		const [year, faculty, degree] = userDegree;

		const semesters = user.semesters.map((s) => s.join('-')).join('|');

		return `/preview/${year}/${faculty}/${degree}?semesters=${semesters}`;
	});

	function getFaculties(
		year: keyof typeof catalogs
	): { value: string; display: string }[] {
		return Object.entries(catalogs[year])
			.filter(([name]) => !['he', 'en'].includes(name))
			.map(([name, faculty]) => ({
				value: name,
				display: content.lang.lang === 'he' ? faculty.he : faculty.en
			}));
	}

	function getDegrees(
		year: Year,
		faculty: string
	): { value: string; display: string }[] {
		const entries: [string, { he: string; en: string }][] = Object.entries(
			// @ts-expect-error
			catalogs[year][faculty]
		);

		return entries
			.filter(([name]) => !['he', 'en'].includes(name))
			.map(([name, degree]) => ({
				value: name,
				display: content.lang.lang === 'he' ? degree.he : degree.en
			}));
	}
</script>

<div>
	<h2 class="text-lg font-medium text-content-primary">
		{content.lang.progress.degree}
	</h2>
	<div class="grid w-fit grid-cols-[auto_auto] items-baseline gap-x-2 gap-y-1">
		<span class="text-content-secondary">
			{content.lang.progress.year}
		</span>
		<Select bind:value={year}>
			{#if year === undefined}
				<option value={undefined}>{content.lang.progress.selectYear}</option>
			{/if}
			{#if years !== undefined}
				{#each years as year}
					<option value={year}>{year.replaceAll('_', '/')}</option>
				{/each}
			{/if}
		</Select>

		{#if year !== undefined}
			<span class="text-content-secondary">
				{content.lang.progress.faculty}
			</span>
			<Select bind:value={faculty}>
				{#if userDegree === undefined && faculty === undefined}
					<option value={undefined}>
						{content.lang.progress.selectFaculty}
					</option>
				{/if}
				{#each getFaculties(year) as { display, value }}
					<option {value}>
						{display}
					</option>
				{/each}
			</Select>
		{/if}

		{#if year !== undefined && faculty !== undefined}
			<span class="text-content-secondary">
				{content.lang.progress.degree}
			</span>
			<Select bind:value={degree}>
				{#if userDegree === undefined && degree === undefined}
					<option value={undefined}>
						{content.lang.progress.selectDegree}
					</option>
				{/if}
				{#each getDegrees(year, faculty) as { display, value }}
					<option {value}>
						{display}
					</option>
				{/each}
			</Select>
		{/if}
	</div>
	<div class="mt-2">
		{#if choiceIsChanged(year, faculty, degree, userDegree)}
			<div>
				{#if choiceIsValid(year, faculty, degree)}
					<Button
						variant="primary"
						onmousedown={() => {
							// @ts-expect-error We validated the choice in `choiceIsValid`
							const didChange = onChange([year, faculty, degree]);

							if (!didChange) {
								reset();
							}
						}}
					>
						{content.lang.progress.save}
					</Button>
				{/if}
				<Button variant="secondary" onmousedown={reset}>
					{content.lang.progress.cancel}
				</Button>
			</div>
		{:else if !onRecommended}
			{#if shareLink !== undefined}
				<a href={shareLink} target="_blank" class="text-content-secondary">
					<Button variant="primary" onmousedown={() => {}}>
						{content.lang.progress.share}
					</Button>
				</a>
			{/if}
			<Button variant="secondary" onmousedown={onReset}>
				{content.lang.progress.revert}
			</Button>
		{/if}
	</div>
</div>
