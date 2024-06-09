<script lang="ts">
	import {
		username,
		degree,
		degreeData,
		semesters,
		getCourseData,
		degreeProgress,
		currentSemester
	} from '$lib/stores';

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

		// if the user has already selected semesters, we should use those
		if ($semesters.length > 0) {
			$degreeProgress = newDegreeData.then((data) =>
				getProgress($semesters, getCourseData, data.requirements)
			);
		}

		// if the user hasn't selected semesters, we should use the recommended ones
		else {
			newDegreeData.then((data) => {
				$semesters = data.recommended;
				$degreeProgress = getProgress(
					$semesters,
					getCourseData,
					data.requirements
				);
			});
		}

		return true;
	}

	let semesterChoice = $currentSemester;
</script>

<div class="flex flex-col space-y-8">
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
		</div>
	{/if}

	{#if $degreeProgress !== undefined}
		<DegreeProgressElement degreeProgress={$degreeProgress} />
	{/if}
</div>
