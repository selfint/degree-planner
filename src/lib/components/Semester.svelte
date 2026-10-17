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
	};

	let {
		getCourseData,
		index,
		isCurrent,
		semester,
		disabled,
		children,
		href,
		sortable
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
			<div>
				<span class="stat-label"
					>{content.lang.lang === 'he' ? 'מבחנים' : 'Exams'}</span
				>
				<span class="stat-value">
					{#await effectiveSemester}–{:then effectiveSemester}
						{effectiveSemester
							.map((c) => c.tests)
							.filter((t) => t !== undefined && t.length > 0).length}
					{/await}
				</span>
			</div>
			<div>
				<span class="stat-label">{content.lang.course.median}</span>
				<span class="stat-value">
					{#await effectiveSemester}–{:then effectiveSemester}{getAvgMedian(
							effectiveSemester
						)}{/await}
				</span>
			</div>
			<div>
				<span class="stat-label">{content.lang.course.points}</span>
				<span class="stat-value">
					{#await effectiveSemester}–{:then effectiveSemester}{effectiveSemester.reduce(
							(a, b) => a + (b.points ?? 0),
							0
						)}{/await}
				</span>
			</div>
		</div>
	</div>
{/snippet}

<CourseWidth class={sortable === undefined ? '' : 'flex h-full flex-col'}>
	<div class="mb-2">
		{#if href !== undefined}
			<a {href} class="semester-link block rounded-[var(--radius-card)]"
				>{@render title()}</a
			>
		{:else}
			{@render title()}
		{/if}
	</div>

	{#await effectiveSemester then _effectiveSemester}
		{#if isCurrent && _effectiveSemester.filter((c) => c.tests?.length ?? 0 > 0).length > 0}
			<div class="mb-2">
				<StudyDaysComponent semester={effectiveSemester} />
			</div>
		{/if}
	{/await}

	<div
		class="semester-courses flex min-h-32 flex-1 flex-col gap-2"
		use:makePlanSortable={sortable}
		data-semester={index}
		data-empty-message={content.lang.lang === 'he'
			? 'הוסיפו קורסים לסמסטר'
			: 'Add courses to this semester'}
	>
		{#each semester as course, index}
			{@render children({ code: course, course: getCourseData(course), index })}
		{/each}
	</div>
</CourseWidth>

<style>
	.semester-heading {
		border-radius: var(--radius-card, 0.875rem);
		border: 0.0625rem solid rgb(var(--color-border));
		border-block-start: 0.1875rem solid rgb(var(--color-border));
		background: rgb(var(--color-card-primary) / 0.5);
		padding: 0.625rem;
	}
	.semester-heading.current {
		border-block-start-color: rgb(var(--color-accent-primary));
		background: rgb(var(--color-accent-primary) / 0.07);
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
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.375rem;
		margin-block-start: 0.625rem;
	}
	.semester-summary > div {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.stat-label {
		color: rgb(var(--color-content-secondary));
		font-size: 0.6875rem;
		line-height: 1.25;
	}
	.stat-value {
		color: rgb(var(--color-content-primary));
		font-size: 0.8125rem;
		line-height: 1.25;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.semester-courses:empty {
		border: 0.0625rem dashed rgb(var(--color-border));
		border-radius: var(--radius-card, 0.875rem);
		background: rgb(var(--color-card-primary) / 0.25);
	}
	.semester-courses:empty::before {
		content: attr(data-empty-message);
		padding: 1rem 0.75rem;
		color: rgb(var(--color-content-secondary));
		font-size: 0.75rem;
		line-height: 1.5;
		text-align: center;
		pointer-events: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.semester-link {
			transition: none;
		}
	}
</style>
