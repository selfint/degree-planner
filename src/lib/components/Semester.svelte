<script lang="ts">
	import type { Snippet } from 'svelte';
	import CourseWidth from './CourseWidth.svelte';
	import StudyDaysComponent from './StudyDaysComponent.svelte';

	import { content } from '$lib/stores.svelte';

	type Props = {
		index: number;
		isCurrent: boolean;
		semester: Course[];
		disabled?: string[];
		children: Snippet<[{ course: Course; index: number }]>;
		href?: string;
	};

	let { index, isCurrent, semester, disabled, children, href }: Props =
		$props();

	const effectiveSemester = $derived(
		semester.filter((c) => !disabled?.includes(c.code))
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
	<div class="flex w-full flex-col items-baseline justify-between sm:flex-row">
		<div class="items-baseline justify-between">
			<h1
				class="border-b-2 {isCurrent
					? 'border-b-accent-primary'
					: 'border-b-transparent'} text-lg font-medium text-content-primary"
			>
				{content.lang.common.seasons[index % 3]}
				{Math.floor(index / 3) + 1}
			</h1>
		</div>
		<div
			class="flex flex-row items-baseline justify-end text-content-secondary"
		>
			<span class="me-1">
				{effectiveSemester
					.map((c) => c.tests)
					.filter((t) => t !== undefined && t.length > 0).length}
			</span>
			<span class="me-1">
				{getAvgMedian(effectiveSemester)}
			</span>
			<span>
				{effectiveSemester.reduce((a, b) => a + (b.points ?? 0), 0)}
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

	{#if isCurrent && effectiveSemester.filter((c) => c.tests?.length ?? 0 > 0).length > 0}
		<div class="mb-1.5">
			<StudyDaysComponent semester={effectiveSemester} />
		</div>
	{/if}

	<div class="flex flex-col space-y-1 sm:space-y-1.5">
		{#each semester as course, index}
			{@render children({ course, index })}
		{/each}
	</div>
</CourseWidth>
