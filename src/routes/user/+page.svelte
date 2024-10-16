<script lang="ts">
	import { goto } from '$app/navigation';
	
	import { user, degreeData } from '$lib/stores.svelte';
	import { getCourseData } from '$lib/courseData';
	import { getProgress } from '$lib/progress';
	import { loadDegreeData } from '$lib/requirements';

	import DegreeSection from './components/DegreeSection.svelte';
	import ProgressSection from './components/ProgressSection.svelte';
	import SemesterSection from './components/SemesterSection.svelte';

	if (user.username === undefined) {
		user.username = 'guest';
	}

	const planned = $derived(user.semesters.map((s) => s.map(getCourseData)));
	const current = $derived(planned.slice(0, user.currentSemester));
	const requirements = $derived(degreeData()?.requirements);

	const degreeProgress = $derived.by(() => {
		if (requirements === undefined) {
			return undefined;
		}

		return {
			current: getProgress(current, requirements),
			planned: getProgress(planned, requirements)
		};
	});

	// we can't trust svelte to notify us when the degree value *actually*
	// changes, so we need to keep track of it ourselves
	// this is *the only* place where we should be setting the degree value
	function onChange(newDegree: Degree): boolean {
		user.degree = newDegree;

		// reset schedule
		user.wishlist = [];
		user.semesters = [];

		loadDegreeData(newDegree).then((data) => {
			user.semesters = data.recommended;
		 goto('/overview');
		});

		return true;
	}

	const maxTotalSemesters = 15;

	const semesterChoice = $derived(user.currentSemester);
	const totalSemestersChoice = $derived(user.semesters.length);

	const maxNonEmptySemesterIndex = $derived(
		user.semesters
			.map((s, i) => [s.length, i])
			.filter(([s]) => s > 0)
			.map(([, i]) => i)
			// get the last non-empty semester
			.reduce((a, b) => Math.max(a, b), 0) + 1
	);

	const validTotalValues = $derived(
		Array.from({ length: maxTotalSemesters }, (_, i) => i + 1).filter(
			(i) => i >= maxNonEmptySemesterIndex
		)
	);
</script>

<div class="mt-3">
	<div class="mb-4 ml-3">
		<DegreeSection degree={user.degree} {onChange} />
	</div>

	{#if user.semesters.length > 0}
		<div class="mb-4 ml-3">
			<SemesterSection
				{semesterChoice}
				{totalSemestersChoice}
				{validTotalValues}
			/>
		</div>
	{/if}

	{#if degreeProgress !== undefined && requirements !== undefined}
		<ProgressSection
			degreeRequirements={requirements}
			current={degreeProgress.current}
			planned={degreeProgress.planned}
		/>
	{/if}
</div>
