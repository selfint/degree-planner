<script lang="ts">
	import ScheduleErrorComponent from './ScheduleErrorComponent.svelte';

	import { generateCourseColor } from '$lib/colors';
	import type { ScheduleError } from '$lib/schedule';
	import CourseWidth from './CourseWidth.svelte';
	import StudyDaysComponent from './StudyDaysComponent.svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		course: Course;
		squeeze?: boolean;
		note?: Snippet;
		scheduleError?: ScheduleError;
		tests?: Course[];
	};

	let { course, note, squeeze = false, scheduleError, tests }: Props = $props();

	const color = $derived(generateCourseColor(course));

	const hasTest = $derived(
		course.tests !== undefined && course.tests.length > 0
	);
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
				class="flex {squeeze
					? ''
					: 'min-h-20 sm:min-h-12'} flex-col justify-between"
			>
				<div class="text-right text-xs leading-none text-content-primary">
					<span class="hyphens-auto break-words" dir="rtl">
						{course.name}

						<span class="text-right leading-none text-content-secondary">
							{course.code}
						</span>
					</span>
				</div>
			</div>
		</div>

		{#if tests !== undefined}
			<div class="p-2 pb-1">
				<StudyDaysComponent {course} semester={tests} />
			</div>
		{/if}

		{#if scheduleError !== undefined}
			<ScheduleErrorComponent {scheduleError} />
		{/if}
	</CourseWidth>
</div>
