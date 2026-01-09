<script lang="ts">
	import ScheduleErrorComponent from './ScheduleErrorComponent.svelte';

	import { generateCourseColor } from '$lib/colors';
	import CourseWidth from './CourseWidth.svelte';
	import StudyDaysComponent from './StudyDaysComponent.svelte';
	import type { Snippet } from 'svelte';
	import Arrow from '$lib/components/Arrow.svelte';

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

	let minimize = $state(false);
	const _scheduleError = $derived.by(() => {
		if (scheduleError === undefined) {
			return false;
		} else if (
			scheduleError.season !== undefined ||
			scheduleError.dependencies.length > 0 ||
			scheduleError.adjacencies.length > 0 ||
			scheduleError.exclusives.length > 0
		) {
			return scheduleError;
		} else {
			return false;
		}
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="h-fit w-fit select-none justify-between rounded-md bg-card-secondary"
	onclick={(e) => {
		if (minimize) {
			e.preventDefault();
			e.stopPropagation();
			minimize = !minimize;
		}
	}}
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

		{#if _scheduleError}
			<button
				class="w-full"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					minimize = !minimize;
				}}
			>
				{#if !minimize}
					<ScheduleErrorComponent scheduleError={_scheduleError} />
				{/if}
				{#if _scheduleError}
					<div
						class="flex h-4 w-full flex-row items-center justify-center text-content-secondary"
					>
						<div class="w-4" class:rotate-180={!minimize}>
							<Arrow />
						</div>
					</div>
				{/if}
			</button>
		{/if}
	</CourseWidth>
</div>
