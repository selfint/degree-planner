<script lang="ts">
	import { page } from '$app/stores';
	import { getCourseData } from '$lib/courseData';

	import {
		currentSemester,
		degreeData,
		semesters,
		wishlist,
		degreeProgress
	} from '$lib/stores';

	import { getCourseLists } from '$lib/requirements';
	import { getProgress } from '$lib/progress';

	import { generateRequirementColor, generateCourseColor } from '$lib/colors';
	import Button from '$lib/components/Button.svelte';

	// get code from path params
	const { code } = $page.params;

	const requirements = $degreeData?.then((d) =>
		getCourseLists(d.requirements, code)
	);

	function formatCourseName(name: string): string {
		return name.split('-').at(1) ?? name;
	}

	function formatRequirementName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	function planCourse(code: string): void {
		$semesters = $semesters.map((s, i) =>
			i === $currentSemester ? [...new Set([...s, code])] : s
		);

		if ($wishlist.includes(code)) {
			$wishlist = $wishlist.filter((c) => c !== code);
		}

		$degreeProgress = $degreeData?.then((data) =>
			getProgress($semesters, getCourseData, data.requirements)
		);
	}

	function removeCourseFromSemesters(code: string): void {
		$semesters = $semesters.map((s) => s.filter((c) => c !== code));
		$degreeProgress = $degreeData?.then((data) =>
			getProgress($semesters, getCourseData, data.requirements)
		);
	}
</script>

<div class="m-3">
	{#await getCourseData(code)}
		<p class="text-content-primary">Loading...</p>
	{:then course}
		<h1 class="mb-2 text-2xl font-medium text-content-primary">
			<span dir="rtl">
				{formatCourseName(course.name ?? code)}
			</span>

			<span class="text-content-secondary">
				{course.code}
			</span>
		</h1>

		<div class="mb-4 flex flex-row items-center space-x-1">
			<div class="m-0 ml-1 p-0">
				<div
					style="background: {generateCourseColor(course)}"
					class="h-8 w-8 rounded-full"
				/>
			</div>
			{#await requirements then requirements}
				{#each requirements ?? [] as requirement}
					<div
						style="background: {generateRequirementColor(requirement)}"
						class="rounded-md pb-0.5 pl-2 pr-2 pt-0.5 leading-none"
					>
						<span class="text-base leading-none text-content-primary">
							{formatRequirementName(requirement)}
						</span>
					</div>
				{/each}
			{/await}
		</div>

		<p class="mb-8 text-content-secondary" dir="rtl">
			{course.about}
		</p>

		<div class="space-x-1">
			{#if $semesters.some((s) => s.includes(course.code))}
				<Button
					variant="secondary"
					onClick={() => removeCourseFromSemesters(course.code)}
				>
					Remove from semester {$semesters.findIndex((s) =>
						s.includes(course.code)
					) + 1}
				</Button>
			{:else}
				<Button variant="primary" onClick={() => planCourse(course.code)}>
					Plan
				</Button>
				{#if $wishlist.includes(course.code)}
					<Button
						variant="secondary"
						onClick={() =>
							($wishlist = $wishlist.filter((c) => c !== course.code))}
					>
						Remove from wish list
					</Button>
				{:else}
					<Button
						variant="secondary"
						onClick={() =>
							($wishlist = [...new Set([...$wishlist, course.code])])}
					>
						Wish list
					</Button>
				{/if}
			{/if}
		</div>
	{/await}
</div>
