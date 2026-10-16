<script lang="ts">
	import CourseElement from '$lib/components/CourseElement.svelte';
	import LoadingCourseElement from '$lib/components/LoadingCourseElement.svelte';
	import { content } from '$lib/preferences.svelte';

	let { state = 'default' } = $props<{
		state?: 'default' | 'loading' | 'empty' | 'requirements';
	}>();
	const example: Course = {
		// Intentionally fictional IDs; never request a production course.
		code: '00000001' as CourseCode,
		name: 'קורס לדוגמה · Example course',
		points: 4,
		median: 86
	};
	const prerequisite: Course = {
		code: '00000002' as CourseCode,
		name: 'מבוא לדוגמה · Example prerequisite',
		points: 3
	};
	const error: ScheduleError = {
		dependencies: [[{ course: prerequisite, taken: false }]],
		adjacencies: [],
		exclusives: []
	};
</script>

<section class="flex flex-col gap-5 p-4" aria-label="Course cards">
	<h1 class="text-xl font-semibold">
		{content.lang.lang === 'he' ? 'כרטיסי קורסים' : 'Course cards'}
	</h1>
	<p class="text-sm text-content-secondary">
		{content.lang.lang === 'he'
			? 'נתוני הדגמה בלבד'
			: 'Fictional courses, no catalog or account requests.'}
	</p>
	{#if state === 'empty'}
		<div
			class="rounded-md border border-dashed border-border p-8 text-content-secondary"
			role="status"
		>
			{content.lang.lang === 'he'
				? 'אין קורסים להצגה'
				: 'No courses to display'}
		</div>
	{:else if state === 'loading'}
		<div class="flex gap-2" role="status" aria-label="Loading courses">
			<LoadingCourseElement /><LoadingCourseElement />
		</div>
	{:else}
		<div class="flex gap-2">
			<CourseElement
				code={example.code}
				course={example}
				scheduleError={state === 'requirements'
					? Promise.resolve(error)
					: undefined}
			/>
			<CourseElement code={prerequisite.code} course={prerequisite} />
		</div>
	{/if}
</section>
