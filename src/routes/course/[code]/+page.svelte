<script lang="ts">
	import { page } from '$app/stores';
	import { getCourseData } from '$lib/courseData';

	import { goto } from '$app/navigation';

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
	import CourseElement from '$lib/components/CourseElement.svelte';

	$: code = $page.params.code;

	const requirements = $degreeData?.then((d) =>
		getCourseLists(d.requirements, code)
	);

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

	function oldCode(code: string): string {
		return code.slice(1, 4) + code.slice(5);
	}
</script>

<div class="m-3">
	{#await getCourseData(code)}
		<p class="text-content-primary">Loading...</p>
	{:then course}
		<h1 class="mb-2 text-2xl font-medium text-content-primary">
			<span dir="rtl">
				{course.name ?? code}
			</span>

			<a
				href={`https://students.technion.ac.il/local/technionsearch/course/${oldCode(code)}`}
				target="_blank"
			>
				<span class="text-content-secondary">
					{course.code}
				</span>
			</a>
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

	<div class="mt-4">
		{#await getCourseData(code) then course}
			{#if (course.connections?.dependencies ?? []).length !== 0}
				<div class="pb-4">
					<h1 class="pb-1 text-lg font-medium text-content-primary">
						Dependencies
					</h1>
					<div class="flex flex-row space-x-2 overflow-x-auto">
						{#each course.connections?.dependencies ?? [] as group, i}
							{#if i !== 0 && group.length > 0}
								<p
									class="flex flex-col justify-center text-sm font-light text-content-secondary"
								>
									OR
								</p>
							{/if}
							<div class="space-y-1">
								{#each group as dep}
									{#await getCourseData(dep) then dep}
										<div
											class="container w-fit"
											tabindex={i}
											role="button"
											on:click={() => goto(`/course/${dep.code}`)}
											on:keydown={(e) => {
												if (e.key === 'Enter') {
													goto(`/course/${dep.code}`);
												}
											}}
										>
											<CourseElement
												course={dep}
												requirements={$degreeData?.then((d) =>
													getCourseLists(d.requirements, dep.code)
												)}
											/>
										</div>
									{/await}
								{/each}
							</div>
						{/each}
					</div>
				</div>
			{/if}
			{#if (course.connections?.adjacent ?? []).length !== 0}
				<div>
					<h1 class="pb-1 text-lg font-medium text-content-primary">
						Adjacencies
					</h1>
					<div class="flex flex-row space-x-2 overflow-x-auto">
						{#each course.connections?.adjacent ?? [] as adj}
							{#await getCourseData(adj) then c}
								<CourseElement
									course={c}
									requirements={$degreeData?.then((d) =>
										getCourseLists(d.requirements, c.code)
									)}
								/>
							{/await}
						{/each}
					</div>
				</div>
			{/if}
		{/await}
	</div>
</div>
