<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	import Button from '$lib/components/Button.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';

	import catalogs from '$lib/assets/catalogs.json';
	import { getCourseData } from '$lib/courseData';
	import { getCourseLists } from '$lib/requirements';

	import { user, content } from '$lib/stores.svelte';

	let { data }: { data: PageData } = $props();

	console.log('here2', data);
	const requirements = $derived(data.degreeData.requirement);

	function formatName(i18n: I18N): string {
		let name = i18n.en;
		if (content.lang.lang === 'he') {
			name = i18n.he;
		}

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
		user.semesters = data.semesters;
		user.degree = data.degreeData.degree;
		user.currentSemester = user.currentSemester ?? 0;
		user.wishlist = user.wishlist.filter(
			(c) => !data.semesters.flat().includes(c)
		);

		goto('/plan');
	}

	function getDegreeName(degree: Degree, userPath: string | undefined): string {
		let year = formatName(catalogs[degree[0]]);
		// @ts-expect-error
		let faculty = formatName(catalogs[degree[0]][degree[1]]);
		// @ts-expect-error
		let path = formatName(catalogs[degree[0]][degree[1]][degree[2]]);

		if (userPath === undefined) {
			return `${faculty} (${content.lang.preview.catalog} ${year}) - ${path}`;
		}

		console.log('here5', userPath, catalogs[degree[0]][degree[1]][degree[2]]);

		let userPathNested = catalogs[degree[0]][degree[1]][
			degree[2]
		].requirement.nested.find((n) => n.name === userPath);

		const userPathName = formatName(userPathNested);

		return `${faculty} (${content.lang.preview.catalog} ${year}) - ${path} ${userPathName}`;
	}
</script>

<div class="mb-3 mt-3">
	<div class="mb-4 ms-3">
		<h1 class="mb-2 text-lg font-medium text-content-primary">
			{getDegreeName(data.degreeData.degree, data.userPath)}
		</h1>
		<Button variant="primary" onclick={importPlan}>
			{content.lang.preview.copy}
		</Button>
	</div>
	<div style="transform: rotateX(180deg)" class="overflow-x-auto">
		<div style="transform: rotateX(180deg)" class="flex flex-row">
			<div class="ms-3"></div>
			{#each data.semesters as semester, semesterIndex}
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
			<div class="min-w-[1px]"></div>
		</div>
	</div>
</div>
