<script lang="ts">
	import ScheduleErrorComponent from './ScheduleErrorComponent.svelte';

	import { generateRequirementColor, generateCourseColor } from '$lib/colors';
	import type { ScheduleError } from '$lib/schedule';
	import CourseWidth from './CourseWidth.svelte';
	import StudyDaysComponent from './StudyDaysComponent.svelte';

	type Props = {
		course: Course;
		lists?: string[];
		squeeze?: boolean;
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

	let { course, lists, squeeze = false, variant }: Props = $props();

	const color = generateCourseColor(course);

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	const median =
		course.median === undefined ? 'N/A' : Math.round(course.median * 10) / 10;

	const hasTest = course.tests !== undefined && course.tests.length > 0;
</script>

<div
	class="h-fit w-fit select-none justify-between rounded-md bg-card-secondary"
>
	<CourseWidth>
		<div class="w-full rounded-md bg-card-primary p-2">
			<div
				class="flex flex-row items-center justify-between pb-1 text-xs text-content-secondary"
			>
				<div class="m-0 ml-1 p-0">
					<div
						style="background: {color}"
						class="h-4 w-4 {hasTest ? 'rounded-full' : ''}"
					></div>
				</div>
				<div class="flex flex-row">
					<span class="mr-2">{median}</span>
					<span>{course.points ?? 'N/A'}</span>
				</div>
			</div>

			<div
				class="flex {squeeze
					? ''
					: 'min-h-28'} flex-col justify-between sm:min-h-14"
			>
				<div class="pb-2 text-right text-xs leading-none text-content-primary">
					<span class="hyphens-auto break-words" dir="rtl">
						{course.name}

						<span class="text-right leading-none text-content-secondary">
							{course.code}
						</span>
					</span>
				</div>

				{#if lists?.length ?? 0 > 0}
					<div class="flex h-fit flex-row items-baseline">
						<div class="flex flex-row flex-wrap items-baseline space-y-1">
							{#each lists ?? [] as requirement}
								<div
									style="background: {generateRequirementColor(requirement)}"
									class="mr-1 rounded-md pb-0.5 pl-2 pr-2 leading-none"
								>
									<span class="text-xs leading-none text-content-primary">
										{formatName(requirement)}
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="hidden text-xs text-content-secondary">
				<span class="mr-2">{median}</span>
				<span>{course.points ?? 'N/A'}</span>
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
