<script lang="ts">
	import { onMount } from 'svelte';
	import { updateSafety } from '$lib/pwa/update-safety';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import PlanActionButton from '$lib/components/PlanActionButton.svelte';
	import { planOnline } from '$lib/planAccess';

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

	let year: Year | undefined = $derived(userDegree?.[0]);
	let faculty: string | undefined = $derived(userDegree?.[1]);
	let degree: string | undefined = $derived(userDegree?.[2]);
	let path: string | undefined = $derived(userPath);

	/**
	 * hack to prevent paths being fetched with stale faculty / degree.
	 *
	 * Without this, if we bind the year value directly to 'year', then when
	 * user selects year:
	 *   1. year is updated
	 *   2. paths is fetched (with state faculty / degree)
	 *   3. faculty / degree set to undefined
	 *   4. paths is updated to []
	 *
	 * With this:
	 *   1. yearChoice is updated
	 *   2. paths is **not** fetched, since year / faculty / degree have not changed
	 *   3. year / faculty / degree is updated
	 *   4. paths is updated to []
	 *
	 * TODO: There must be a better way to do this.
	 */
	let yearChoice = $derived(year);

	const years = $derived(Object.keys(catalogs) as Year[]);
	const faculties = $derived(getFaculties(year));
	const degrees = $derived(getDegrees(year, faculty));
	const paths = $derived(getPaths(year, faculty, degree));
	const choiceIsValid = $derived(
		_choiceIsValid(paths, year, faculty, degree, path)
	);

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

	async function _choiceIsValid(
		paths: Promise<{ value: string; display: string }[]>,
		y?: string,
		f?: string,
		d?: string,
		p?: string
	): Promise<boolean> {
		let c = catalogs;

		// @ts-expect-error
		const catalog = c[y]?.[f]?.[d];
		if (catalog === undefined) {
			return false;
		}

		const _paths = await paths;
		if (_paths.length === 0) {
			return true;
		} else if (p === undefined) {
			return false;
		} else {
			const r = _paths.map((p) => p.value).includes(p);
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
		updateSafety.discardFailure();
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
		year?: Year,
		faculty?: string,
		degree?: string
	): Promise<{ value: string; display: string }[]> {
		if ([year, faculty, degree].includes(undefined)) {
			return [];
		}

		let r = await loadRequirement([year, faculty, degree] as Degree);

		return (r.nested ?? [])
			.filter(({ en }) => en.toLowerCase().includes('path'))
			.map(({ name, en, he }) => ({
				value: name,
				display: content.lang.lang === 'he' ? he : en
			}));
	}
	const updateDraft = $derived(
		year !== userDegree?.[0] ||
			faculty !== userDegree?.[1] ||
			degree !== userDegree?.[2] ||
			path !== userPath
	);
	onMount(() => updateSafety.register(() => updateDraft));
	$effect(() => {
		void updateDraft;
		updateSafety.refresh();
	});
</script>

<section class="degree-section">
	<h2 class="section-title">{content.lang.settings.degree}</h2>
	<div class="degree-fields">
		<label class="settings-field">
			<span>{content.lang.settings.year}</span>
			<Select
				disabled={!$planOnline}
				bind:value={yearChoice}
				onchange={() => {
					year = yearChoice;
					faculty = undefined;
					degree = undefined;
					path = undefined;
				}}
			>
				<option value={undefined} disabled>
					{content.lang.settings.selectYear}
				</option>
				{#each years as yearSemester}
					{@const [year, semester] = yearSemester.split('_')}
					<option value={yearSemester}>
						{year}
						{content.lang.common.seasons[parseInt(semester) - 200]}
					</option>
				{/each}
			</Select>
		</label>

		<label class="settings-field">
			<span>{content.lang.settings.faculty}</span>
			<Select
				disabled={!$planOnline}
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
					<option {value}>{display}</option>
				{/each}
			</Select>
		</label>

		<label class="settings-field field-wide">
			<span>{content.lang.settings.degree}</span>
			<Select
				disabled={!$planOnline}
				bind:value={degree}
				onchange={() => {
					path = undefined;
				}}
			>
				<option value={undefined} disabled>
					{content.lang.settings.selectDegree}
				</option>
				{#each degrees as { display, value }}
					<option {value}>{display}</option>
				{/each}
			</Select>
		</label>

		{#if year !== undefined && faculty !== undefined && degree !== undefined}
			<div class="field-wide">
				{#await paths}
					<div class="settings-field">
						<span>{content.lang.settings.path}</span>
						<div class="field-status" role="status">
							<span class="h-5 w-5 shrink-0" aria-hidden="true"
								><Spinner /></span
							>
							<span>{content.lang.common.loading}</span>
						</div>
					</div>
				{:then paths}
					{#if paths.length > 0}
						<label class="settings-field">
							<span>{content.lang.settings.path}</span>
							<Select disabled={!$planOnline} bind:value={path}>
								<option value={undefined} disabled>
									{content.lang.settings.selectPath}
								</option>
								{#each paths as { display, value }}
									<option {value}>{display}</option>
								{/each}
							</Select>
						</label>
					{:else}
						<div class="settings-field no-path-field">
							<span>{content.lang.settings.path}</span>
							<p class="field-status no-path">{content.lang.settings.noPath}</p>
						</div>
					{/if}
				{/await}
			</div>
		{/if}
	</div>
	{#if choiceIsChanged(year, faculty, degree, path, userDegree, userPath)}
		<div class="section-actions">
			{#await choiceIsValid}
				<AsyncButton disabled={true} variant="primary">
					{content.lang.settings.save}
				</AsyncButton>
			{:then isValid}
				<PlanActionButton
					disabled={!isValid}
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
				</PlanActionButton>
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
	{:else if !onRecommended && recommended !== undefined}
		<div class="section-actions">
			<Button variant="secondary" disabled={!$planOnline} onclick={onReset}>
				{content.lang.settings.revert}
			</Button>
		</div>
	{/if}
</section>

<style>
	.degree-section {
		min-inline-size: 0;
		text-align: start;
	}
	.section-title {
		margin-block-end: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.4;
	}
	.degree-fields {
		display: grid;
		gap: 0.5rem;
	}
	.settings-field {
		display: grid;
		grid-template-columns: 5rem minmax(0, 1fr);
		align-items: center;
		min-inline-size: 0;
		gap: 0.5rem;
	}
	.settings-field > span {
		font-weight: 500;
	}
	.field-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: rgb(var(--color-content-secondary));
	}
	.no-path-field {
		grid-template-columns: minmax(0, 5rem) max-content;
	}
	.no-path {
		white-space: nowrap;
	}
	.section-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-block-start: 0.625rem;
	}
	@media (min-width: 40rem) {
		.degree-fields {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			column-gap: 1rem;
		}
		.field-wide {
			grid-column: 1 / -1;
		}
	}
</style>
