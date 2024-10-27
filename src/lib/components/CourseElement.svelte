<script lang="ts">
	import ScheduleErrorComponent from './ScheduleErrorComponent.svelte';

	import { generateCourseColor, generateRequirementColor } from '$lib/colors';
	import type { ScheduleError } from '$lib/schedule';
	import CourseWidth from './CourseWidth.svelte';
	import StudyDaysComponent from './StudyDaysComponent.svelte';
	import RequirementsElement from './RequirementsElement.svelte';
	import type { Snippet } from 'svelte';

	import { content } from '$lib/stores.svelte';

	type Props = {
		course: Course;
		lists?: Requirement[][];
		squeeze?: boolean;
		note?: Snippet;
		variant?:
			| {
					type: 'schedule';
					error: ScheduleError;
			  }
			| {
					type: 'test';
					semester: Course[];
			  };
	};

	let { course, lists = [], note, squeeze = false, variant }: Props = $props();

	const totalCols = 4;

	const listSizes = $derived.by(() => {
		const totalRows = 2;

		const rows = Array.from(
			{ length: totalRows },
			() => [] as [Requirement[], number][]
		);
		const available = Array.from({ length: totalRows }, () => totalCols);

		const sorted = lists.toSorted((a, b) => b.length - a.length);

		for (const list of sorted) {
			const size = Math.min(totalCols, list.length);

			let hasSpace = false;
			for (let i = 0; i < totalRows; i++) {
				const row = rows[i];
				const rowSize = row.reduce((acc, [l, s]) => acc + s, 0);

				if (rowSize + size <= totalCols) {
					row.push([list, size]);
					available[i] -= size;
					hasSpace = true;
					break;
				}
			}

			if (hasSpace) {
				continue;
			}

			// Find the row with the most space
			let emptiestRow = 0;
			for (let i = 1; i < totalRows; i++) {
				if (available[i] > available[emptiestRow]) {
					emptiestRow = i;
				}
			}

			rows[emptiestRow].push([list, size]);
			available[emptiestRow] -= size;
		}

		// Expand rows if possible
		for (let i = 0; i < totalRows; i++) {
			const row = rows[i];
			const rowSize = row.reduce((acc, [l, s]) => acc + s, 0);
			let space = totalCols - rowSize;

			if (row.length === 0) {
				continue;
			}

			while (space > 0) {
				const mostShrunkAmount = Math.max(
					...row.map(([item, size]) => item.length - size)
				);

				const mostShrunkIndex = row.findIndex(
					([item, size]) => item.length - size === mostShrunkAmount
				);

				row[mostShrunkIndex][1]++;
				space--;
			}

			available[i] = space;
		}

		// Shrink rows if needed
		for (let i = 0; i < totalRows; i++) {
			const row = rows[i];
			let availableSpace = available[i];

			if (row.length === 0) {
				continue;
			}

			while (availableSpace < 0) {
				const largestItemValue = Math.min(
					...row.map(([item, size]) => item.length - size)
				);
				const largestItemIndex = row.findIndex(
					([item, size]) => item.length - size === largestItemValue
				);

				row[largestItemIndex][1]--;
				available[i]++;
				availableSpace++;
			}
		}

		return rows.flat();
	});

	const color = generateCourseColor(course);

	const hasTest = course.tests !== undefined && course.tests.length > 0;
	function formatName(requirement: Requirement): string {
		let name = requirement.name;

		if (requirement.he !== undefined && content.lang.lang === 'he') {
			name = requirement.he;
		}

		name = name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');

		return name;
	}
</script>

<div
	class="h-fit w-fit select-none justify-between rounded-md bg-card-secondary"
>
	<CourseWidth>
		<div class="w-full rounded-md bg-card-primary p-2">
			<div
				class="flex flex-row items-center justify-between pb-1 text-xs text-content-secondary"
			>
				<div class="flex flex-row">
					<div
						style="background: {color}"
						class="h-4 min-w-4 {hasTest ? 'rounded-full' : ''}"
					></div>
					{#if note !== undefined}
						<span class="me-1 ms-1">
							{@render note()}
						</span>
					{/if}
				</div>
				<span>
					<span>{course.median ?? ''}</span>
					<span>{course.points ?? ''}</span>
				</span>
			</div>

			<div
				class="flex {!squeeze &&
					'max-h-28 min-h-28'} flex-col justify-between sm:max-h-16 sm:min-h-16"
			>
				<div class="text-right text-xs leading-none text-content-primary">
					<span class="hyphens-auto break-words" dir="rtl">
						{course.name}

						<span class="text-right leading-none text-content-secondary">
							{course.code}
						</span>
					</span>
				</div>

				{#if listSizes?.length ?? 0 > 0}
					<div
						style="grid-template-columns: repeat({totalCols}, 1fr);"
						class="container mt-1 w-fit text-xs text-content-primary"
					>
						{#each listSizes as [list, size]}
							<div
								style="grid-column: span {size};"
								class="flex h-4 flex-row leading-none"
							>
								{#if list.length === 1}
									{@const item = list[0]}
									<span
										class="flex min-w-2 items-center overflow-hidden overflow-ellipsis text-nowrap rounded-full pe-1.5 ps-1.5"
										style="background: {generateRequirementColor(item.name)};"
									>
										{formatName(item)}
									</span>
								{:else}
									{#each list as item, i}
										<span
											class="{i > 0 &&
												'ms-0.5'} flex min-w-4 max-w-fit flex-grow items-center justify-center
												{i === 0 && 'rounded-s-full'}
												{i === list.length - 1 && 'rounded-e-full'}
												"
											style="background: {generateRequirementColor(
												item.name
											)}; flex-grow: {item.name.length - 5};"
										>
											<span
												class="{i > 0
													? 'ps-1'
													: 'ps-1.5'} me-1.5 min-w-5 overflow-hidden overflow-ellipsis text-nowrap text-start"
											>
												{formatName(item)}
											</span>
										</span>
									{/each}
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		{#if variant?.type === 'schedule'}
			<ScheduleErrorComponent scheduleError={variant.error} />
		{/if}

		{#if variant?.type === 'test'}
			<div class="p-2 pb-1">
				<StudyDaysComponent {course} semester={variant.semester} />
			</div>
		{/if}
	</CourseWidth>
</div>

<style>
	.container {
		display: grid;
		gap: 0.25rem 0.5rem;
	}
</style>
