<script lang="ts">
	import { user, content, requirement, degreeName } from '$lib/stores.svelte';
	import { getDegreeRequirementCourses } from '$lib/requirements';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	const { data: pageData } = $props();
	const { getCourseData } = $derived(pageData);

	const lists = $derived.by(async () => {
		const r = requirement();
		if (r === undefined) {
			return [];
		}

		return getDegreeRequirementCourses(await r);
	});

	function getCourseSemester(course: Course): number | undefined {
		const index = user.d.semesters.findIndex((s) => s.includes(course.code));

		if (index === -1) {
			return undefined;
		} else {
			return index;
		}
	}

	const seasonEmojis = ['❄️', '🌿', '☀️'];

	const planned = $derived([...user.d.semesters.flat(), ...user.d.exemptions]);
	const current = $derived([
		...user.d.semesters.slice(0, user.d.currentSemester).flat(),
		...user.d.exemptions
	]);

	const totalCurrentCount = $derived(current.length);
	const totalPlannedCount = $derived(planned.length);
	const totalCurrentPoints = $derived.by(() =>
		Promise.all(current.map(getCourseData)).then((p) =>
			p.reduce((sum, { points }) => sum + (points ?? 0), 0)
		)
	);
	const totalPlannedPoints = $derived.by(() =>
		Promise.all(planned.map(getCourseData)).then((p) =>
			p.reduce((sum, { points }) => sum + (points ?? 0), 0)
		)
	);
</script>

{#snippet progressMetric(
	label: string,
	done: number,
	planned: number,
	total?: number
)}
	<div class="catalog-metric">
		<p class="catalog-metric-label">{label}</p>
		<dl class="catalog-values">
			<div>
				<dt>{content.lang.landing.catalog.done}</dt>
				<dd class="text-accent-primary">{done}</dd>
			</div>
			<div>
				<dt>{content.lang.landing.catalog.planned}</dt>
				<dd>{planned}</dd>
			</div>
			{#if total !== undefined}
				<div>
					<dt>{content.lang.landing.catalog.total}</dt>
					<dd>{total}</dd>
				</div>
			{/if}
		</dl>
		<ProgressBar
			value={done}
			value2={planned}
			max={Math.max(total ?? planned, 1)}
			dir={content.lang.dir}
		/>
	</div>
{/snippet}

{#snippet courseNote(course: Course)}
	{@const index = getCourseSemester(course)}
	{#if index !== undefined}
		<span>
			{seasonEmojis[index % 3]}
			<span class="hidden sm:inline">
				{content.lang.common.seasons[index % 3]}
				{Math.floor(index / 3) + 1}
			</span>
		</span>
	{:else if user.d.exemptions.includes(course.code)}
		<span>✓</span>
		<span class="hidden sm:inline">{content.lang.catalog.exempt}</span>
	{:else if user.d.wishlist.includes(course.code)}
		<span>🌟</span>
		<span class="hidden sm:inline">{content.lang.catalog.wishlist}</span>
	{/if}
{/snippet}

<div class="catalog-page">
	<header class="catalog-inset">
		<h1 class="ui-page-title">{content.lang.common.catalog}</h1>
	</header>

	{#if user.d.degree !== undefined}
		<section class="catalog-summary catalog-inset">
			<h2 class="catalog-section-title">
				{#await degreeName()}
					<span class="catalog-loading" role="status">
						<span class="h-5 w-5 shrink-0"><Spinner /></span>
						{content.lang.common.loading}
						{content.lang.common.catalog}
					</span>
				{:then name}
					{name}
				{/await}
			</h2>
			<div class="catalog-progress">
				{@render progressMetric(
					content.lang.settings.count,
					totalCurrentCount,
					totalPlannedCount
				)}
				{#await Promise.all([totalCurrentPoints, totalPlannedPoints])}
					<div class="catalog-loading" role="status">
						<span class="h-5 w-5 shrink-0"><Spinner /></span>
						{content.lang.common.loading}
						{content.lang.settings.points}
					</div>
				{:then [currentPoints, plannedPoints]}
					{@render progressMetric(
						content.lang.settings.points,
						currentPoints,
						plannedPoints
					)}
				{/await}
			</div>
		</section>
	{:else}
		<div class="catalog-empty catalog-empty-degree catalog-inset">
			<a class="ui-button ui-button--secondary" href="/app/settings"
				>{content.lang.settings.selectDegree}</a
			>
		</div>
	{/if}

	{#if user.d.wishlist.length > 0}
		<section class="catalog-section">
			<h2 class="catalog-section-title catalog-inset">
				{content.lang.catalog.wishlist}
			</h2>
			<CourseRow {getCourseData} courses={user.d.wishlist} indent={1}>
				{#snippet children({ code, course, index })}
					<a href={`/app/course/${code}`}>
						<CourseElement
							{code}
							{course}
							{index}
							styleOnCourse={(c) =>
								Promise.resolve(c.current ? '' : 'opacity: 0.6')}
						>
							{#snippet note(course)}
								{@render courseNote(course)}
							{/snippet}
						</CourseElement>
					</a>
				{/snippet}
			</CourseRow>
		</section>
	{/if}

	{#if user.d.degree !== undefined}
		{#await lists}
			<div class="catalog-loading catalog-inset" role="status">
				<span class="h-5 w-5 shrink-0"><Spinner /></span>
				{content.lang.common.loading}
				{content.lang.common.catalog}
			</div>
		{:then lists}
			{#each lists as list}
				{#if list.courses.length > 0}
					{@const listPlanned = list.courses.filter((c) => planned.includes(c))}
					{@const listCurrent = list.courses.filter((c) => current.includes(c))}
					{@const pointsCurrent = Promise.all(
						listCurrent.map(getCourseData)
					).then((p) => p.reduce((sum, { points }) => sum + (points ?? 0), 0))}
					{@const pointsPlanned = Promise.all(
						listPlanned.map(getCourseData)
					).then((p) => p.reduce((sum, { points }) => sum + (points ?? 0), 0))}
					{@const pointsTotal = Promise.all(
						list.courses.map(getCourseData)
					).then((p) => p.reduce((sum, { points }) => sum + (points ?? 0), 0))}

					<section class="catalog-section">
						<h2 class="catalog-section-title catalog-path catalog-inset">
							{#each list.path as title, index}
								{#if index > 0}<span
										class="catalog-path-separator"
										aria-hidden="true">/</span
									>{/if}
								<span>{content.lang.lang === 'he' ? title.he : title.en}</span>
							{/each}
						</h2>
						<div class="catalog-progress catalog-progress-panel catalog-inset">
							{@render progressMetric(
								content.lang.settings.count,
								listCurrent.length,
								listPlanned.length,
								list.courses.length
							)}
							{#await Promise.all([pointsCurrent, pointsPlanned, pointsTotal])}
								<div class="catalog-loading" role="status">
									<span class="h-5 w-5 shrink-0"><Spinner /></span>
									{content.lang.common.loading}
									{content.lang.settings.points}
								</div>
							{:then [currentPoints, plannedPoints, totalPoints]}
								{@render progressMetric(
									content.lang.settings.points,
									currentPoints,
									plannedPoints,
									totalPoints
								)}
							{/await}
						</div>
						<CourseRow {getCourseData} courses={list.courses} indent={1}>
							{#snippet children({ code, course, index })}
								<a href={`/app/course/${code}`}>
									<CourseElement {code} {course} {index}>
										{#snippet note(course)}
											{@render courseNote(course)}
										{/snippet}
									</CourseElement>
								</a>
							{/snippet}
						</CourseRow>
					</section>
				{/if}
			{:else}
				<p class="catalog-empty catalog-inset">
					{content.lang.lang === 'he' ? 'אין קורסים' : 'No courses'}
				</p>
			{/each}
		{/await}
	{/if}
</div>

<style>
	.catalog-page {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.875rem;
		inline-size: 100%;
		min-inline-size: 0;
		padding-block: 0.625rem;
	}
	.catalog-inset {
		margin-inline: 0.75rem;
	}
	.catalog-summary {
		padding-block-end: 0.75rem;
		border-block-end: 1px solid rgb(var(--color-border));
	}
	.catalog-section {
		min-inline-size: 0;
	}
	.catalog-section-title {
		margin-block-end: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}
	.catalog-path {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.5rem;
	}
	.catalog-path-separator {
		color: rgb(var(--color-content-secondary));
		font-weight: 400;
	}
	.catalog-progress {
		display: grid;
		gap: 0.5rem;
		max-inline-size: 48rem;
	}
	.catalog-progress-panel {
		margin-block-end: 0.625rem;
	}
	.catalog-metric {
		display: grid;
		grid-template-columns: 3.5rem minmax(0, 1fr);
		align-items: baseline;
		gap: 0.25rem 0.5rem;
		min-inline-size: 0;
	}
	.catalog-metric > :global(:last-child) {
		grid-column: 1 / -1;
	}
	.catalog-metric-label {
		font-size: 0.8125rem;
		font-weight: 500;
	}
	.catalog-values {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.625rem;
	}
	.catalog-values > div {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}
	.catalog-values dt {
		color: rgb(var(--color-content-secondary));
		font-size: 0.75rem;
	}
	.catalog-values dd {
		font-size: 0.8125rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.catalog-loading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: rgb(var(--color-content-secondary));
		font-size: 0.8125rem;
		font-weight: 400;
	}
	.catalog-empty {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: rgb(var(--color-content-secondary));
		font-size: 0.8125rem;
		line-height: 1.5;
	}
	.catalog-empty-degree {
		flex-wrap: wrap;
		justify-content: space-between;
	}
	@media (min-width: 48rem) {
		.catalog-progress {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 1.25rem;
		}
	}
</style>
