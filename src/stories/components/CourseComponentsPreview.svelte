<script lang="ts">
	import CourseElement from '$lib/components/CourseElement.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import Semester from '$lib/components/Semester.svelte';
	import StudyDaysComponent from '$lib/components/StudyDaysComponent.svelte';
	import RequirementsElement from '$lib/components/RequirementsElement.svelte';
	import ScheduleErrorComponent from '$lib/components/ScheduleErrorComponent.svelte';
	import {
		courses,
		getCourseData,
		pending,
		requirementFixture,
		scheduleFixture,
		emptySchedule
	} from '../../../.storybook/fixtures';
	let {
		kind = 'CourseElement',
		state = 'default'
	}: { kind?: string; state?: string } = $props();
	const course = $derived(
		state === 'missingDetails'
			? { code: courses[0].code }
			: state === 'noExams'
				? { ...courses[0], tests: undefined }
				: courses[0]
	);
	const getData = $derived(
		state === 'loading' ? () => pending<Course>() : getCourseData
	);
	const semester = $derived(
		state === 'empty' ? [] : courses.map((c) => c.code)
	);
	const errors = $derived(
		state === 'season'
			? { ...emptySchedule, season: [0, 1] }
			: state === 'adjacent'
				? { ...emptySchedule, adjacencies: scheduleFixture.adjacencies }
				: state === 'exclusive'
					? { ...emptySchedule, exclusives: scheduleFixture.exclusives }
					: state === 'satisfied'
						? {
								...emptySchedule,
								dependencies: [[{ course: courses[0], taken: true }]]
							}
						: state === 'empty'
							? emptySchedule
							: scheduleFixture
	);
</script>

{#if kind === 'CourseElement'}
	<CourseElement
		code={course.code}
		course={state === 'loading' ? pending<Course>() : course}
		squeeze={state === 'compact'}
		tests={state === 'studyDays'
			? Promise.resolve(courses.slice(1))
			: undefined}
		scheduleError={state === 'checking'
			? pending<ScheduleError>()
			: state === 'requirements'
				? Promise.resolve(scheduleFixture)
				: undefined}
		styleOnCourse={state === 'unavailable'
			? async () => 'opacity: 0.6'
			: undefined}
	>
		{#snippet note()}{#if state === 'note'}★ Example note{/if}{/snippet}
	</CourseElement>
{:else if kind === 'CourseRow'}
	<CourseRow
		getCourseData={getData}
		courses={semester}
		sortable={state === 'sortable' ? { animation: 150 } : undefined}
		indent={state === 'indented' ? 3 : 1}
	>
		{#snippet children({ code, course })}<CourseElement
				{code}
				{course}
			/>{/snippet}
	</CourseRow>
{:else if kind === 'Semester'}
	<Semester
		getCourseData={getData}
		index={state === 'summer' ? 2 : 0}
		isCurrent={state === 'current'}
		{semester}
		href={state === 'linked' ? '/app/semester?semester=0' : undefined}
		disabled={state === 'excluded' ? [courses[0].code] : undefined}
		sortable={state === 'sortable' ? { animation: 150 } : undefined}
	>
		{#snippet children({ code, course })}<CourseElement
				{code}
				{course}
				squeeze
			/>{/snippet}
	</Semester>
{:else if kind === 'StudyDaysComponent'}
	<StudyDaysComponent
		semester={state === 'loading'
			? pending<Course[]>()
			: Promise.resolve(
					state === 'empty'
						? []
						: state === 'oneExam'
							? [courses[0]]
							: state === 'highlighted'
								? courses.filter((c) => c.code !== courses[1].code)
								: courses
				)}
		course={state === 'highlighted' ? courses[1] : undefined}
	/>
{:else if kind === 'RequirementsElement'}
	<RequirementsElement
		requirements={state === 'empty'
			? []
			: state === 'single'
				? [[requirementFixture.nested![0]]]
				: [[requirementFixture, ...requirementFixture.nested!]]}
		slice={state === 'lastOnly' ? 1 : undefined}
		maxWidth={state === 'truncated' ? 8 : undefined}
	/>
{:else if kind === 'ScheduleErrorComponent'}
	<ScheduleErrorComponent scheduleError={errors} />
{/if}
{#if state === 'empty'}<p class="mt-3 text-sm text-content-secondary">
		This component deliberately renders no items for an empty input.
	</p>{/if}
