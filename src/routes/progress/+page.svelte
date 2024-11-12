<script lang="ts">
	import { user, catalog, content } from '$lib/stores.svelte';
	import { getCourseData } from '$lib/courseData';
	import { getProgress } from '$lib/progress';
	import { loadCatalog } from '$lib/requirements';

	import DegreeSection from './components/DegreeSection.svelte';
	import ProgressSection from './components/ProgressSection.svelte';
	import SemesterSection from './components/SemesterSection.svelte';

	if (user.username === undefined) {
		user.username = 'guest';
	}

	const planned = $derived(user.semesters.map((s) => s.map(getCourseData)));
	const current = $derived(planned.slice(0, user.currentSemester));
	const requirements = $derived(catalog()?.requirement);
	const recommended = $derived(catalog()?.recommended);

	const degreeProgress = $derived.by(() => {
		if (requirements === undefined) {
			return undefined;
		}

		const currentProgress = getProgress(current, requirements);
		const plannedProgress = getProgress(planned, requirements);

		// global hook for total points
		currentProgress.courses.done = current.flat();
		currentProgress.points.done = current
			.flat()
			.reduce((acc, c) => acc + (c.points ?? 0), 0);

		plannedProgress.courses.done = planned.flat();
		plannedProgress.points.done = planned
			.flat()
			.reduce((acc, c) => acc + (c.points ?? 0), 0);

		return {
			current: currentProgress,
			planned: plannedProgress
		};
	});

	// we can't trust svelte to notify us when the degree value *actually*
	// changes, so we need to keep track of it ourselves
	// this is *the only* place where we should be setting the degree value
	function onChange(newDegree: Degree): boolean {
		loadCatalog(newDegree).then((data) => {
			user.degree = newDegree;

			if (user.semesters.length === 0) {
				user.semesters = data.recommended ?? [];
				while (user.semesters.length < user.currentSemester) {
					user.semesters.push([]);
				}
				user.wishlist = user.wishlist.filter(
					(c) => !data.recommended.flat().includes(c)
				);
			}
		});

		return true;
	}

	function onReset() {
		if (recommended !== undefined) {
			if (!confirm(content.lang.preview.overwriteWarning)) {
				return;
			}

			user.semesters = recommended;
			user.wishlist = user.wishlist.filter(
				(c) => !recommended.flat().includes(c)
			);
		}
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
	<div class="mb-4 ms-3">
		<DegreeSection degree={user.degree} {onChange} {onReset} {recommended} />
	</div>

	{#if user.username !== undefined}
		<div class="mb-4 ms-3">
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
