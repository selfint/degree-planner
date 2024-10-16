<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import Button from '$lib/components/Button.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';

	import { getCourseData } from '$lib/courseData';
	import { getCourseLists } from '$lib/requirements';

	import { user } from '$lib/stores.svelte';

	const { data } = $props();
	const { year, faculty, path } = $derived($page.params);
	const requirements = $derived(data.degreeData.requirements);

	const semesters: string[][] = $derived(
		($page.url.searchParams.get('semesters') ?? '')
			.trim()
			.split(';')
			.map((s) => s.split(',').filter((c) => c !== ''))
	);

	function formatName(name: string): string {
		return (
			name[0].toUpperCase() +
			name
				.slice(1)
				.toLowerCase()
				.split('_')
				.map((word) => (word.length > 2 ? word : word.toUpperCase()))
				.join(' ')
		);
	}

	function importPlan() {
		if (user.semesters.length > 0) {
			const userConfirmation = confirm(
				'This will overwrite your current plan and is irreversible. Are you sure you want to continue?'
			);

			if (!userConfirmation) {
				return;
			}
		}

		user.username = 'guest';
		user.semesters = semesters;
		user.degree = [year, faculty, path];
		user.currentSemester = user.currentSemester ?? 0;
		user.wishlist = user.wishlist.filter((c) => !semesters.flat().includes(c));

		goto('/overview');
	}
</script>

<div class="mb-3 mt-3">
	<div class="mb-4 ml-3">
		<h1 class="mb-2 text-lg font-medium text-content-primary">
			{formatName(faculty)}
			{formatName(path)}
			(catalog {formatName(year)})
		</h1>
		<Button variant="primary" onmousedown={importPlan}>Copy plan</Button>
	</div>
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
						{#snippet children({ course, index: i })}
							<div
								class="touch-manipulation"
								onmousedown={() => goto(`/course/${course.code}`)}
								role="button"
								tabindex={i}
							>
								<CourseElement
									{course}
									lists={getCourseLists(requirements, course.code)}
									squeeze={true}
								/>
							</div>
						{/snippet}
					</Semester>
				{/each}
			{/key}
			<div class="min-w-[1px]"></div>
		</div>
	</div>
</div>
