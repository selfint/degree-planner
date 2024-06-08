<script lang="ts">
	import {
		username,
		degree,
		degreeData,
		semesters,
		getCourseData,
		degreeProgress
	} from '$lib/stores';

	import DegreeSection from './components/DegreeSection.svelte';

	import { loadDegreeData, loadDegreeRecommendation } from '$lib/requirements';
	import { getProgress } from '$lib/progress';
	import DegreeProgressElement from './components/DegreeProgressElement.svelte';

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
		if ($semesters.length === 0) {
			$degreeProgress = $degreeData.then((data) =>
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
</script>

<div class="flex flex-col space-y-8">
	<h1 class="text-2xl font-medium text-content-primary">
		Welcome, {$username}
	</h1>

	<DegreeSection degree={$degree} {onChange} />

	{#if $degreeProgress !== undefined}
		<DegreeProgressElement degreeProgress={$degreeProgress} />
	{:else}
		Loading
	{/if}
</div>
