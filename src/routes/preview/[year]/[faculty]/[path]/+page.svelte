<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import Button from '$lib/components/Button.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';

	import catalogs from '$lib/assets/catalogs.json';
	import { getCourseData } from '$lib/courseData';
	import { getCourseLists } from '$lib/requirements';

	import { user, content } from '$lib/stores.svelte';

	const { data } = $props();
	const requirements = $derived(data.degreeData.requirement);

	const semesters: string[][] = $derived.by(() => {
		const semesters = $page.url.searchParams.get('semesters') ?? '';

		return semesters
			.trim()
			.split('|')
			.map((s) => s.split('-').filter((c) => c !== ''));
	});

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
			const userConfirmation = confirm(content.lang.preview.overwriteWarning);

			if (!userConfirmation) {
				return;
			}
		}

		user.username = 'guest';
		user.semesters = semesters;
		user.degree = data.degreeData.degree;
		user.currentSemester = user.currentSemester ?? 0;
		user.wishlist = user.wishlist.filter((c) => !semesters.flat().includes(c));

		goto('/plan');
	}

	function getDegreeName(degree: Degree): string {
		let year = degree[0];
		let faculty = degree[1];
		let path = degree[2];

		if (content.lang.lang === 'he') {
			// @ts-expect-error
			path = catalogs[year][faculty][path].he;

			// @ts-expect-error
			faculty = catalogs[year][faculty].he;
		}

		return `${formatName(faculty)} ${formatName(path)} (${content.lang.preview.catalog} ${formatName(year)})`;
	}
</script>

<div class="mb-3 mt-3">
	<div class="mb-4 ms-3">
		<h1 class="mb-2 text-lg font-medium text-content-primary">
			{getDegreeName(data.degreeData.degree)}
		</h1>
		<Button variant="primary" onmousedown={importPlan}>
			{content.lang.preview.copy}
		</Button>
	</div>
	<div style="transform: rotateX(180deg)" class="overflow-x-auto">
		<div style="transform: rotateX(180deg)" class="flex flex-row">
			<div class="ms-3"></div>
			{#key semesters.flat().join(' ')}
				{#each semesters as semester, semesterIndex}
					<div class="pe-2" role="button" tabindex={semesterIndex}>
						<Semester
							index={semesterIndex}
							semester={semester.map(getCourseData)}
							isCurrent={false}
						>
							{#snippet children({ course })}
								<button
									class="touch-manipulation text-content-primary"
									onclick={() => goto(`/course/${course.code}`)}
								>
									<CourseElement
										{course}
										lists={getCourseLists(requirements, course.code)}
										squeeze={true}
									/>
								</button>
							{/snippet}
						</Semester>
					</div>
				{/each}
			{/key}
			<div class="min-w-[1px]"></div>
		</div>
	</div>
</div>
