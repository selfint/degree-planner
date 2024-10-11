<script lang="ts">
	import {
		username,
		degree,
		degreeData,
		semesters,
		currentSemester,
		wishlist
	} from '$lib/stores';
	import { getCourseData } from '$lib/courseData';
	import { getProgress } from '$lib/progress';
	import { loadDegreeData } from '$lib/requirements';

	import DegreeSection from './components/DegreeSection.svelte';
	import RequirementsSection from './components/DegreeProgressElement.svelte';
	import SemesterSection from './components/SemesterSection.svelte';

	if ($username === undefined) {
		$username = 'guest';
	}

	$: degreeProgress = $degreeData?.then(async (data) => {
		const semesterCourses = $semesters.map((s) => s.map(getCourseData));

		return {
			current: getProgress(
				semesterCourses.slice(0, $currentSemester),
				data.requirements
			),
			planned: getProgress(semesterCourses, data.requirements)
		};
	});

	// we can't trust svelte to notify us when the degree value *actually*
	// changes, so we need to keep track of it ourselves
	// this is *the only* place where we should be setting the degree value
	function onChange(newDegree: Degree): boolean {
		const newDegreeData = loadDegreeData(newDegree);
		$degree = newDegree;
		$degreeData = newDegreeData;

		// reset schedule
		$wishlist = [];
		$semesters = [];

		newDegreeData.then((data) => {
			$semesters = data.recommended;
		});

		return true;
	}

	const maxTotalSemesters = 15;

	$: semesterChoice = $currentSemester;
	let totalSemestersChoice = $semesters.length;

	semesters.subscribe((s) => (totalSemestersChoice = s.length));

	$: maxNonEmptySemesterIndex =
		$semesters
			.map((s, i) => [s.length, i])
			.filter(([s]) => s > 0)
			.map(([, i]) => i)
			// get the last non-empty semester
			.reduce((a, b) => Math.max(a, b), 0) + 1;
	$: validTotalValues = Array.from(
		{ length: maxTotalSemesters },
		(_, i) => i + 1
	).filter((i) => i >= maxNonEmptySemesterIndex);
</script>

<div class="m-3">
	<div class="mb-4">
		<DegreeSection degree={$degree} {onChange} />
	</div>

	{#if $semesters.length > 0}
		<div class="mb-4">
			<SemesterSection
				{semesterChoice}
				{totalSemestersChoice}
				{validTotalValues}
			/>
		</div>
	{/if}

	{#if degreeProgress !== undefined}
		{#await degreeProgress}
			<div class="text-content-secondary">Loading...</div>
		{:then { current, planned }}
			<RequirementsSection {current} {planned} />
		{/await}
	{/if}
</div>
