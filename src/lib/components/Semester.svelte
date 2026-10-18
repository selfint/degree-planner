<script lang="ts">
	import type { Snippet } from 'svelte';

	import type Sortable from 'sortablejs';
	import { makePlanSortable } from '$lib/planDrag';

	import CourseWidth from './CourseWidth.svelte';
	import StudyDaysComponent from './StudyDaysComponent.svelte';

	import { content } from '$lib/stores.svelte';

	type Props = {
		getCourseData: GetCourseData;
		index: number;
		isCurrent: boolean;
		semester: string[];
		disabled?: string[];
		children: Snippet<
			[{ code: string; course: Promise<Course>; index: number }]
		>;
		href?: string;
		sortable?: Sortable.Options;
		board?: boolean;
	};

	let {
		getCourseData,
		index,
		isCurrent,
		semester,
		disabled,
		children,
		href,
		sortable,
		board = false
	}: Props = $props();

	const effectiveSemester = $derived.by(
		async () =>
			await Promise.all(
				semester.filter((c) => !disabled?.includes(c)).map(getCourseData)
			)
	);

	function getAvgMedian(courses: Course[]): number {
		const medians: number[] = courses
			.map((c) => c.median)
			.filter((m) => m !== undefined);

		return medians.length > 0
			? Math.round((medians.reduce((a, b) => a + b) / medians.length) * 10) / 10
			: 0;
	}
</script>

{#snippet title()}
	<div class="semester-heading" class:current={isCurrent}>
		<h2 class="text-sm font-semibold leading-snug text-content-primary">
			{content.lang.common.seasons[index % 3]}
			{Math.floor(index / 3) + 1}
		</h2>
		<div class="semester-summary">
			<span class="stat-value" title={content.lang.course.points}>
				{#await effectiveSemester}–{:then effectiveSemester}{effectiveSemester.reduce(
						(a, b) => a + (b.points ?? 0),
						0
					)}{/await}
				<span>{content.lang.lang === 'he' ? 'נק׳' : 'cr'}</span>
			</span>
			<span
				class="stat-label"
				title={content.lang.lang === 'he' ? 'קורסים' : 'Courses'}
			>
				{semester.filter((c) => !disabled?.includes(c)).length}
				{content.lang.lang === 'he' ? 'קורסים' : 'courses'}
			</span>
			<span class="sr-only">
				{content.lang.course.median}: {#await effectiveSemester}–{:then effectiveSemester}{getAvgMedian(
						effectiveSemester
					)}{/await}.
				{content.lang.lang === 'he' ? 'מבחנים' : 'Exams'}: {#await effectiveSemester}–{:then effectiveSemester}{effectiveSemester.filter(
						(c) => c.tests !== undefined && c.tests.length > 0
					).length}{/await}
			</span>
		</div>
	</div>
{/snippet}

<CourseWidth
	class={board
		? 'semester-column--board'
		: sortable === undefined
			? ''
			: 'flex h-full flex-col'}
>
	<div class="semester-title mb-1.5">
		{#if href !== undefined}
			<a {href} class="semester-link block rounded-[var(--radius-card)]"
				>{@render title()}</a
			>
		{:else}
			{@render title()}
		{/if}
	</div>

	<div class="semester-exams-row">
		{#await effectiveSemester then _effectiveSemester}
			{#if isCurrent && _effectiveSemester.filter((c) => c.tests?.length ?? 0 > 0).length > 0}
				<div class="semester-exams mb-1.5">
					<StudyDaysComponent semester={effectiveSemester} />
				</div>
			{/if}
		{/await}
	</div>

	<div
		class="semester-courses flex min-h-32 flex-1 flex-col gap-1.5"
		use:makePlanSortable={sortable}
		data-semester={index}
	>
		{#each semester as course, index}
			{@render children({ code: course, course: getCourseData(course), index })}
		{/each}
	</div>
</CourseWidth>

<style>
	/* The board owns these three tracks. Header wrapping and study-day content
	   therefore move every course list together, including empty drop targets. */
	:global(.semester-column--board) {
		display: grid;
		grid-row: 1 / -1;
		grid-template-rows: subgrid;
	}
	:global(.semester-column--board) .semester-title {
		display: flex;
		flex-direction: column;
	}
	:global(.semester-column--board) .semester-title > :global(*) {
		flex: 1;
	}
	:global(.semester-column--board) .semester-heading {
		block-size: 100%;
	}
	.semester-heading {
		border-block-end: 0.125rem solid rgb(var(--color-border));
		padding: 0.25rem 0;
	}
	.semester-heading.current {
		border-block-end-color: rgb(var(--color-accent-primary));
	}
	.semester-link {
		transition: background-color 160ms ease;
	}
	.semester-link:hover {
		background: rgb(var(--color-card-primary));
	}
	.semester-link:focus-visible {
		outline: 0.125rem solid rgb(var(--color-accent-primary));
		outline-offset: 0.125rem;
	}
	.semester-summary {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.125rem 0.375rem;
	}
	.stat-label {
		color: rgb(var(--color-content-secondary));
		font-size: 0.625rem;
		line-height: 1rem;
	}
	.stat-value {
		color: rgb(var(--color-content-primary));
		font-size: 0.75rem;
		line-height: 1rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
	.semester-courses:empty {
		border: 0.0625rem dashed rgb(var(--color-border));
		border-radius: var(--radius-card, 0.875rem);
		background: rgb(var(--color-card-primary) / 0.25);
	}
	@media (prefers-reduced-motion: reduce) {
		.semester-link {
			transition: none;
		}
	}
</style>
