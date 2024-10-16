<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import type { PageData } from './$types';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';

	import { getCourseData } from '$lib/courseData';
	import { getCourseLists } from '$lib/requirements';
	import { getScheduleError } from '$lib/schedule';

	// get degreeData from +page.ts
	const { data } = $props();
	const requirements = $derived(data.degreeData.requirements);

	const semesters: string[][] = $derived(
		($page.url.searchParams.get('semesters') ?? '')
			.trim()
			.split(';')
			.map((s) => s.split(','))
	);
</script>

<div class="mt-3">
	<div style="transform: rotateX(180deg)" class="overflow-x-auto">
		<div style="transform: rotateX(180deg)" class="flex flex-row space-x-3">
			<div></div>
			{#key semesters.flat().join(' ')}
				{#each semesters as semester, semesterIndex}
					<Semester
						index={semesterIndex}
						semester={semester.map(getCourseData)}
						isCurrent={false}
					>
						{#snippet children({ course })}
							<a class="touch-manipulation" href="/course/{course.code}">
								<CourseElement
									{course}
									lists={getCourseLists(requirements, course.code)}
									squeeze={true}
								/>
							</a>
						{/snippet}
					</Semester>
				{/each}
			{/key}
			<div class="min-w-[1px]"></div>
		</div>
	</div>
</div>
