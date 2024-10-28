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

				{#if lists?.length ?? 0 > 0}
					<div
						style="grid-template-columns: repeat(4, 1fr);"
						class="mt-1 grid w-fit gap-x-0.5 gap-y-1 text-xs text-content-primary"
					>
						{#each lists as list}
							{@const size = list.length}
							{@const total = lists.reduce((acc, l) => acc + l.length, 0)}
							{@const span = Math.min(4, Math.floor((size / total) * 4 * 3))}
							{@const spanSm = Math.min(4, Math.floor((size / total) * 4 * 2))}
							<div
								style="--col-span: {span}; --col-span-sm: {spanSm};"
								class="col-span sm:col-span-sm flex h-4 flex-row leading-none"
							>
								{#if list.length === 1}
									{@const item = list[0]}
									<span
										class="flex min-w-4 items-center overflow-hidden overflow-ellipsis text-nowrap rounded-full pe-1.5 ps-1.5"
										style="background: {generateRequirementColor(item.name)};"
									>
										<span
											class="overflow-hidden overflow-ellipsis text-nowrap text-start"
										>
											{formatName(item)}
										</span>
									</span>
								{:else}
									{@const items = list.slice(-2)}
									{#each items as item, i}
										<span
											class="{i > 0 &&
												'ms-0.5'} flex min-w-2 max-w-fit items-center justify-center
												{i === 0 ? 'rounded-s-full ps-1.5' : 'ps-0.5'}
												{i === items.length - 1 ? 'rounded-e-full pe-1.5' : 'pe-0.5'}
												"
											style="background: {generateRequirementColor(
												item.name
											)}; flex-grow: {i === 0 || i === items.length - 1
												? 1
												: 0};"
										>
											<span
												class="overflow-hidden overflow-ellipsis text-nowrap text-start"
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
	.col-span {
		grid-column: span var(--col-span);
	}

	@media (min-width: 640px) {
		.col-span {
			grid-column: span var(--col-span-sm);
		}
	}
</style>
