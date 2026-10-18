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
	<div
		class="semester-heading flex w-full flex-col items-start justify-between sm:flex-row"
	>
		<div class="items-baseline justify-start">
			<h2
				class="border-b-2 {isCurrent
					? 'border-b-accent-primary'
					: 'border-b-transparent'} text-base font-medium text-content-primary"
			>
				{content.lang.common.seasons[index % 3]}
				{Math.floor(index / 3) + 1}
			</h2>
		</div>
		<div
			class="semester-summary flex flex-row items-baseline justify-end text-content-secondary"
		>
			<span
				class="semester-tests me-1"
				title={content.lang.lang === 'he' ? 'מבחנים' : 'Tests'}
			>
				{#await effectiveSemester}
					-
				{:then effectiveSemester}
					{effectiveSemester
						.map((c) => c.tests)
						.filter((t) => t !== undefined && t.length > 0).length}
				{/await}
				<span class="sr-only">
					{content.lang.lang === 'he' ? 'מבחנים' : 'tests'}
				</span>
			</span>
			<span
				class="semester-median me-1"
				title={content.lang.lang === 'he' ? 'ממוצע חציונים' : 'Average median'}
			>
				{#await effectiveSemester}
					-
				{:then effectiveSemester}
					{getAvgMedian(effectiveSemester)}
				{/await}
				<span class="sr-only">
					{content.lang.lang === 'he' ? 'ממוצע חציונים' : 'average median'}
				</span>
			</span>
			<span class="semester-points" title={content.lang.course.points}>
				{#await effectiveSemester}
					-
				{:then effectiveSemester}
					{effectiveSemester.reduce((a, b) => a + (b.points ?? 0), 0)}
				{/await}
				<span class="sr-only">{content.lang.course.points}</span>
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
	/* Keep accessible metric labels inside their own boxes when their semester
	   is scrolled offscreen, rather than escaping the rail into page overflow. */
	.semester-summary > span {
		position: relative;
	}
	.semester-summary .sr-only {
		inset-block-start: 0;
		inset-inline-start: 0;
		margin: 0;
	}
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
