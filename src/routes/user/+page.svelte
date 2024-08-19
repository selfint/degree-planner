<script lang="ts">
	import {
		username,
		degree,
		degreeData,
		semesters,
		degreeProgress,
		currentSemester,
		wishlist
	} from '$lib/stores';

	import { getCourseData, cacheDegreeCourses } from '$lib/courseData';

	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';

	import DegreeSection from './components/DegreeSection.svelte';
	import DegreeProgressElement from './components/DegreeProgressElement.svelte';

	import { loadDegreeData } from '$lib/requirements';
	import { getProgress } from '$lib/progress';

	if ($username === undefined) {
		$username = 'guest';
	}

	// we can't trust svelte to notify us when the degree value *actually*
	// changes, so we need to keep track of it ourselves
	// this is *the only* place where we should be setting the degree value
	function onChange(newDegree: Degree): boolean {
		const newDegreeData = loadDegreeData(newDegree);
		$degree = newDegree;
		$degreeData = newDegreeData;

		// reset wishlist
		$wishlist = [];

		$degreeProgress = newDegreeData.then((data) =>
			getProgress($semesters, getCourseData, data.requirements)
		);
		newDegreeData.then((data) => {
			$semesters = data.recommended;
			$degreeProgress = getProgress(
				$semesters,
				getCourseData,
				data.requirements
			);
		});

		// cache the courses for the degree
		newDegreeData.then((data) => cacheDegreeCourses(data));

		return true;
	}

	let semesterChoice = $currentSemester;
	let totalSemestersChoice = $semesters.length;

	const maxNonEmptySemesterIndex =
		$semesters
			.map((s, i) => [s.length, i])
			.filter(([s]) => s > 0)
			.map(([, i]) => i)
			// get the last non-empty semester
			.reduce((a, b) => Math.max(a, b), 0) + 1;
	const maxTotalSemesters = 15;
	const validTotalValues = Array.from(
		{ length: maxTotalSemesters },
		(_, i) => i + 1
	).filter((i) => i >= maxNonEmptySemesterIndex);
</script>

<div class="m-3 flex flex-col space-y-8">
	<h1 class="text-2xl font-medium text-content-primary">
		Welcome, {$username}
	</h1>

	<DegreeSection degree={$degree} {onChange} />

	{#if $semesters.length > 0}
		<div class="flex flex-col space-y-2">
			<h2 class="text-xl text-content-primary">Semester</h2>
			<div class="flex flex-row items-baseline space-x-3">
				<span class="text-content-secondary"> Current: </span>
				<Select bind:value={semesterChoice}>
					{#each Array.from({ length: $semesters.length }) as _, i}
						<option value={i}>
							{['Winter', 'Spring', 'Summer'][i % 3]}
							{Math.floor(i / 3) + 1}
						</option>
					{/each}
				</Select>

				{#if semesterChoice !== $currentSemester}
					<Button
						variant="primary"
						onClick={() => {
							if (semesterChoice !== $currentSemester) {
								$currentSemester = semesterChoice;
							}
						}}
					>
						Save
					</Button>
					<Button
						variant="secondary"
						onClick={() => (semesterChoice = $currentSemester)}
					>
						Cancel
					</Button>
				{/if}
			</div>
			<div class="flex flex-row items-baseline space-x-3">
				<span class="text-content-secondary"> Total: </span>
				<Select bind:value={totalSemestersChoice}>
					{#each validTotalValues as i}
						<option value={i}>
							{i}
							({['Winter', 'Spring', 'Summer'][(i - 1) % 3]}
							{Math.floor((i - 1) / 3) + 1})
						</option>
					{/each}
				</Select>

				{#if totalSemestersChoice !== $semesters.length}
					<Button
						variant="primary"
						onClick={() => {
							if (totalSemestersChoice < $semesters.length) {
								$semesters = $semesters.slice(0, totalSemestersChoice);
							} else if (totalSemestersChoice > $semesters.length) {
								$semesters = $semesters.concat(
									Array.from({
										length: totalSemestersChoice - $semesters.length
									}).map(() => [])
								);
							}
						}}
					>
						Save
					</Button>
					<Button
						variant="secondary"
						onClick={() => (totalSemestersChoice = $semesters.length)}
					>
						Cancel
					</Button>
				{/if}
			</div>
		</div>
	{/if}

	{#if $degreeProgress !== undefined}
		<DegreeProgressElement degreeProgress={$degreeProgress} />
	{/if}
</div>
