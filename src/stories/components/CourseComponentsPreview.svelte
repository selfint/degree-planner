<script lang="ts">
	import { content } from '$lib/preferences.svelte';
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
		state: variant = 'default'
	}: { kind?: string; state?: string } = $props();
	let opened = $state(0);
	const interactive = $derived(
		variant === 'interactive' || variant === 'interactiveRequirements'
	);
	$effect(() => {
		variant;
		opened = 0;
	});
	const course = $derived(
		variant === 'missingDetails'
			? { code: courses[0].code }
			: variant === 'noExams'
				? { ...courses[0], tests: undefined }
				: courses[0]
	);
	const getData = $derived(
		variant === 'loading' ? () => pending<Course>() : getCourseData
	);
	const semester = $derived(
		variant === 'empty' ? [] : courses.map((c) => c.code)
	);
	const errors = $derived(
		variant === 'season'
			? { ...emptySchedule, season: [0, 1] }
			: variant === 'adjacent'
				? { ...emptySchedule, adjacencies: scheduleFixture.adjacencies }
				: variant === 'exclusive'
					? { ...emptySchedule, exclusives: scheduleFixture.exclusives }
					: variant === 'satisfied'
						? {
								...emptySchedule,
								dependencies: [[{ course: courses[0], taken: true }]]
							}
						: variant === 'empty'
							? emptySchedule
							: scheduleFixture
	);
</script>

{#if kind === 'CourseElement'}
	<CourseElement
		onOpen={interactive ? () => opened++ : undefined}
		code={course.code}
		course={variant === 'loading' ? pending<Course>() : course}
		squeeze={variant === 'compact'}
		tests={variant === 'studyDays'
			? Promise.resolve(courses.slice(1))
			: undefined}
		scheduleError={variant === 'checking'
			? pending<ScheduleError>()
			: variant === 'requirements' || variant === 'interactiveRequirements'
				? Promise.resolve(scheduleFixture)
				: undefined}
		styleOnCourse={variant === 'unavailable'
			? async () => 'opacity: 0.6'
			: undefined}
	>
		{#snippet note()}{#if variant === 'note'}★ Example note{/if}{/snippet}
	</CourseElement>
	{#if interactive}<output class="mt-3 block text-sm text-content-secondary"
			>{content.lang.lang === 'he'
				? 'פתיחות קורס בהדגמה'
				: 'Demo course opens'}: {opened}</output
		>{/if}
{:else if kind === 'CourseRow'}
	<CourseRow
		getCourseData={getData}
		courses={semester}
		sortable={variant === 'sortable' ? { animation: 150 } : undefined}
		indent={variant === 'indented' ? 3 : 1}
	>
		{#snippet children({ code, course })}<CourseElement
				{code}
				{course}
			/>{/snippet}
	</CourseRow>
{:else if kind === 'Semester'}
	<Semester
		getCourseData={getData}
		index={variant === 'summer' ? 2 : 0}
		isCurrent={variant === 'current'}
		{semester}
		href={variant === 'linked' ? '/app/semester?semester=0' : undefined}
		disabled={variant === 'excluded' ? [courses[0].code] : undefined}
		sortable={variant === 'sortable' ? { animation: 150 } : undefined}
	>
		{#snippet children({ code, course })}<CourseElement
				{code}
				{course}
				squeeze
			/>{/snippet}
	</Semester>
{:else if kind === 'StudyDaysComponent'}
	<StudyDaysComponent
		semester={variant === 'loading'
			? pending<Course[]>()
			: Promise.resolve(
					variant === 'empty'
						? []
						: variant === 'oneExam'
							? [courses[0]]
							: variant === 'highlighted'
								? courses.filter((c) => c.code !== courses[1].code)
								: courses
				)}
		course={variant === 'highlighted' ? courses[1] : undefined}
	/>
{:else if kind === 'RequirementsElement'}
	<RequirementsElement
		requirements={variant === 'empty'
			? []
			: variant === 'single'
				? [[requirementFixture.nested![0]]]
				: [[requirementFixture, ...requirementFixture.nested!]]}
		slice={variant === 'lastOnly' ? 1 : undefined}
		maxWidth={variant === 'truncated' ? 8 : undefined}
	/>
{:else if kind === 'ScheduleErrorComponent'}
	<ScheduleErrorComponent scheduleError={errors} />
{/if}
{#if variant === 'empty'}<p class="mt-3 text-sm text-content-secondary">
		This component deliberately renders no items for an empty input.
	</p>{/if}
