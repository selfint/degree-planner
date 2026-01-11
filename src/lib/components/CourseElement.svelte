<script lang="ts">
	import ScheduleErrorComponent from './ScheduleErrorComponent.svelte';

	import { generateCourseColor } from '$lib/colors';
	import CourseWidth from './CourseWidth.svelte';
	import StudyDaysComponent from './StudyDaysComponent.svelte';
	import type { Snippet } from 'svelte';
	import Arrow from '$lib/components/Arrow.svelte';
	import Spinner from './Spinner.svelte';

	type Props = {
		course: Promise<Course> | Course;
		squeeze?: boolean;
		note?: Snippet;
		scheduleError?: Promise<ScheduleError>;
		tests?: Course[];
	};

	let { course, note, squeeze = false, scheduleError, tests }: Props = $props();

	const color = $derived(Promise.resolve(course).then(generateCourseColor));

	const hasTest = $derived(
		Promise.resolve(course).then(
			(c) => c.tests !== undefined && c.tests.length > 0
		)
	);

	let minimize = $state(false);
	const _scheduleError = $derived.by(async () => {
		if (scheduleError === undefined) {
			return false;
		} else if (
			await scheduleError.then(
				(se) =>
					se.season !== undefined ||
					se.dependencies.length > 0 ||
					se.adjacencies.length > 0 ||
					se.exclusives.length > 0
			)
		) {
			return await scheduleError;
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
					{#await hasTest}
						<div style="background: {color}" class="h-4 min-w-4"></div>
					{:then hasTest}
						<div
							style="background: {color}"
							class="h-4 min-w-4 {hasTest ? 'rounded-full' : ''}"
						></div>
					{/await}
					{#if note !== undefined}
						<span class="me-1 ms-1">
							{@render note()}
						</span>
					{/if}
				</div>
				<span>
					{#await course then course}
						<span>{course.median ?? ''}</span>
						<span>{course.points ?? ''}</span>
					{/await}
				</span>
			</div>

			<div
				class="flex {squeeze
					? ''
					: 'min-h-20 sm:min-h-12'} flex-col justify-between"
			>
				<div class="text-right text-xs leading-none text-content-primary">
					<span class="hyphens-auto break-words" dir="rtl">
						{#await course then course}
							{course.name}

							<span class="text-right leading-none text-content-secondary">
								{course.code}
							</span>
						{/await}
					</span>
				</div>
			</div>
		</div>

		{#if tests !== undefined}
			<div class="p-2 pb-1">
				{#await course then course}
					<StudyDaysComponent {course} semester={tests} />
				{/await}
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
				{#await _scheduleError}
					<Spinner />
				{:then _scheduleError}
					{#if !minimize && _scheduleError !== false}
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
				{/await}
			</button>
		{/if}
	</CourseWidth>
</div>
