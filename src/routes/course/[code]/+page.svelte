<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import Button from '$lib/components/Button.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';

	import {
		currentSemester,
		degreeData,
		semesters,
		wishlist
	} from '$lib/stores';

	import { getCourseData, getAllCourses } from '$lib/courseData';
	import { getCourseLists } from '$lib/requirements';
	import { generateRequirementColor, generateCourseColor } from '$lib/colors';
	import Progress from '$lib/components/Progress.svelte';

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
	}

	function removeCourseFromSemesters(code: string): void {
		$semesters = $semesters.map((s) => s.filter((c) => c !== code));
	}

	$: code = $page.params.code;
	$: course = getCourseData(code);
	$: requirements = $degreeData?.then((d) =>
		getCourseLists(d.requirements, code)
	);
	$: dependants = getAllCourses()
		.filter((c) =>
			(c.connections?.dependencies ?? []).some((group) => group.includes(code))
		)
		.filter((c) => c.code !== undefined && c.name !== undefined)
		.toSorted((a, b) => {
			const medians = (b.median ?? 0) - (a.median ?? 0);

			if (medians !== 0) {
				return medians;
			}

			return a.code.localeCompare(b.code);
		});
	$: info = [
		['Median', course.median, 100],
		['Points', course.points, 7]
	] as const;
</script>

<div class="m-3">
	<h1 class="mb-2 text-lg font-medium text-content-primary">
		<span dir="rtl">
			{course.name ?? code}
		</span>

		<a
			href={`https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2024/200/SM/${code}`}
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

	<div class="mt-4">
		<h2 class="pb-1 text-lg font-medium text-content-primary">Grades</h2>
		<div
			class="grid w-fit grid-flow-row grid-cols-[auto_auto_auto] items-center gap-x-2 text-content-secondary"
		>
			{#each info as [name, value, max]}
				<span>{name}</span>
				<div>
					{#if value === undefined}
						<span class="w-fit">Unknown</span>
					{:else}
						<Progress {value} {max} />
					{/if}
				</div>
				<span>{value}</span>
			{/each}
			<span
				>Available this semester: {course?.current === true
					? 'Yes'
					: 'No'}</span
			>
		</div>
	</div>

	<div class="mt-4">
		{#if (course.connections?.dependencies ?? []).length !== 0}
			<div class="pb-4">
				<h2 class="pb-1 text-lg font-medium text-content-primary">
					Dependencies
				</h2>
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
							{#each group.map(getCourseData) as dep}
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
										lists={$degreeData?.then((d) =>
											getCourseLists(d.requirements, dep.code)
										)}
									/>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}
		{#if (course.connections?.adjacent ?? []).length !== 0}
			<div>
				<h2 class="pb-1 text-lg font-medium text-content-primary">
					Adjacencies
				</h2>
				<div class="flex flex-row space-x-2 overflow-x-auto">
					{#each course.connections?.adjacent.map(getCourseData) ?? [] as adj}
						<CourseElement
							course={adj}
							lists={$degreeData?.then((d) =>
								getCourseLists(d.requirements, adj.code)
							)}
						/>
					{/each}
				</div>
			</div>
		{/if}
		<div>
			{#if dependants.length > 0}
				<h2 class="pb-1 text-lg font-medium text-content-primary">
					Dependants
				</h2>
				<div class="flex flex-row flex-wrap">
					{#each dependants as c, i}
						<div
							class="container w-fit pb-4 pr-2"
							tabindex={i}
							role="button"
							on:click={() => goto(`/course/${c.code}`)}
							on:keydown={(e) => {
								if (e.key === 'Enter') {
									goto(`/course/${c.code}`);
								}
							}}
						>
							<CourseElement
								course={c}
								lists={$degreeData?.then((d) =>
									getCourseLists(d.requirements, c.code)
								)}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
