<script lang="ts">
	import type { Snippet } from 'svelte';

	import Sortable from 'sortablejs';

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

	function makeSortable(column: HTMLDivElement) {
		if (sortable !== undefined) {
			new Sortable(column, sortable);
		}
	}
</script>

{#snippet title()}
	<div class="flex w-full flex-col items-start justify-between sm:flex-row">
		<div class="items-baseline justify-start">
			<h1
				class="border-b-2 {isCurrent
					? 'border-b-accent-primary'
					: 'border-b-transparent'} text-base font-medium text-content-primary"
			>
				{content.lang.common.seasons[index % 3]}
				{Math.floor(index / 3) + 1}
			</h1>
		</div>
		<div
			class="flex flex-row items-baseline justify-end text-content-secondary"
		>
			<span class="me-1">
				{#await effectiveSemester}
					-
				{:then effectiveSemester}
					{effectiveSemester
						.map((c) => c.tests)
						.filter((t) => t !== undefined && t.length > 0).length}
				{/await}
			</span>
			<span class="me-1">
				{#await effectiveSemester}
					-
				{:then effectiveSemester}
					{getAvgMedian(effectiveSemester)}
				{/await}
			</span>
			<span>
				{#await effectiveSemester}
					-
				{:then effectiveSemester}
					{effectiveSemester.reduce((a, b) => a + (b.points ?? 0), 0)}
				{/await}
			</span>
		</div>
	</div>
{/snippet}

<CourseWidth>
	<div class="mb-0.5 sm:mb-1.5">
		{#if href !== undefined}
			<a {href}>
				{@render title()}
			</a>
		{:else}
			{@render title()}
		{/if}
	</div>

	{#await effectiveSemester then _effectiveSemester}
		{#if isCurrent && _effectiveSemester.filter((c) => c.tests?.length ?? 0 > 0).length > 0}
			<div class="mb-1.5">
				<StudyDaysComponent semester={effectiveSemester} />
			</div>
		{/if}
	{/await}

	<div
		class="flex h-full min-h-32 flex-col space-y-1 bg-opacity-50 sm:space-y-1.5"
		use:makeSortable
	>
		{#each semester as course, index}
			{@render children({ code: course, course: getCourseData(course), index })}
		{/each}
	</div>
</CourseWidth>
