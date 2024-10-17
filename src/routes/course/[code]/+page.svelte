<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import Button from '$lib/components/Button.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';

	import { user, degreeData } from '$lib/stores.svelte';
	import { cms } from '$lib/content';

	import { getCourseData, getAllCourses } from '$lib/courseData';
	import { getCourseLists } from '$lib/requirements';
	import { generateRequirementColor, generateCourseColor } from '$lib/colors';

	const lang = cms.en;

	const code = $derived($page.params.code);
	const course = $derived(getCourseData(code));
	const requirements = $derived(degreeData()?.requirements);

	const courseMemberRequirements = $derived.by(() => {
		if (requirements === undefined) {
			return [];
		}

		return getCourseLists(requirements, code);
	});

	const dependants = $derived(
		getAllCourses()
			.filter((c) =>
				(c.connections?.dependencies ?? []).some((group) =>
					group.includes(code)
				)
			)
			.filter((c) => c.code !== undefined && c.name !== undefined)
			.toSorted((a, b) => {
				const medians = (b.median ?? 0) - (a.median ?? 0);

				if (medians !== 0) {
					return medians;
				}

				return a.code.localeCompare(b.code);
			})
	);

	function formatRequirementName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	function planCourse(code: string): void {
		const current = user.semesters[user.currentSemester];
		if (!current.includes(code)) {
			current.push(code);
		}

		if (user.wishlist.includes(code)) {
			user.wishlist = user.wishlist.filter((c) => c !== code);
		}
	}

	function removeCourseFromSemesters(code: string): void {
		user.semesters = user.semesters.map((s) => s.filter((c) => c !== code));
	}

	function getSeasonAndIndex(semesterIndex: number): string {
		const season = lang.common.seasons[semesterIndex % 3];
		const modIndex = Math.floor(semesterIndex / 3) + 1;
		return `${season} ${modIndex}`;
	}
</script>

<div class="mt-3">
	<h1 class="mb-2 ml-3 text-lg font-medium text-content-primary">
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

	<div class="mb-4 ml-3 flex flex-row items-center space-x-1">
		<div class="m-0 ml-1 p-0">
			<div
				style="background: {generateCourseColor(course)}"
				class="h-8 w-8 rounded-full"
			></div>
		</div>
		{#each courseMemberRequirements as requirement}
			<div
				style="background: {generateRequirementColor(requirement)}"
				class="rounded-md pb-0.5 pl-2 pr-2 pt-0.5 leading-none"
			>
				<span class="text-base leading-none text-content-primary">
					{formatRequirementName(requirement)}
				</span>
			</div>
		{/each}
	</div>

	<p class="mb-8 ml-3 mr-3 text-content-secondary" dir="rtl">
		{course.about}
	</p>

	<div class="ml-3 mr-3 space-x-1">
		{#if user.semesters.some((s) => s.includes(course.code))}
			<Button
				variant="secondary"
				onmousedown={() => removeCourseFromSemesters(course.code)}
			>
				{lang.course.removeFromSemester}
				{getSeasonAndIndex(
					user.semesters.findIndex((s) => s.includes(course.code))
				)}
			</Button>
		{:else}
			<Button variant="primary" onmousedown={() => planCourse(course.code)}>
				{lang.course.plan}
			</Button>
			{#if user.wishlist.includes(course.code)}
				<Button
					variant="secondary"
					onmousedown={() =>
						(user.wishlist = user.wishlist.filter((c) => c !== course.code))}
				>
					{lang.course.removeFromWishlist}
				</Button>
			{:else}
				<Button
					variant="secondary"
					onmousedown={() =>
						(user.wishlist = [...new Set([...user.wishlist, course.code])])}
				>
					{lang.course.wishlist}
				</Button>
			{/if}
		{/if}
	</div>

	<div class="ml-3 mt-4">
		<h2 class="pb-1 text-lg font-medium text-content-primary">
			{lang.course.info}
		</h2>
		<div
			class="grid w-fit grid-flow-row grid-cols-[auto_auto] items-center gap-x-2 text-content-secondary"
		>
			<span>{lang.course.median}</span>
			<span>{course.median ?? lang.common.na}</span>
			<span>{lang.course.points}</span>
			<span>{course.points ?? lang.common.na}</span>
			<span>{lang.course.available}</span>
			<span>{course?.current ? lang.common.yes : lang.common.no}</span>
		</div>
	</div>

	<div class="mt-4">
		{#if (course.connections?.dependencies ?? []).length !== 0}
			<div class="pb-4">
				<h2 class="ml-3 pb-1 text-lg font-medium text-content-primary">
					{lang.common.dependencies}
				</h2>
				<div class="flex flex-row space-x-2 overflow-x-auto">
					<div class="min-w-1"></div>
					{#each course.connections?.dependencies ?? [] as group, i}
						{#if i !== 0 && group.length > 0}
							<p
								class="flex flex-col justify-center text-sm font-light text-content-secondary"
							>
								{lang.course.or}
							</p>
						{/if}
						<div class="space-y-1">
							{#each group.map(getCourseData) as dep}
								<div
									class="container w-fit"
									tabindex={i}
									role="button"
									onclick={() => goto(`/course/${dep.code}`)}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											goto(`/course/${dep.code}`);
										}
									}}
								>
									<CourseElement
										course={dep}
										lists={getCourseLists(requirements, dep.code)}
									/>
								</div>
							{/each}
						</div>
					{/each}
					<div class="min-w-1"></div>
				</div>
			</div>
		{/if}
		{#if (course.connections?.adjacent ?? []).length !== 0}
			<div>
				<h2 class="ml-3 pb-1 text-lg font-medium text-content-primary">
					{lang.common.adjacencies}
				</h2>
				<div class="flex flex-row space-x-2 overflow-x-auto">
					{#each course.connections?.adjacent.map(getCourseData) ?? [] as adj}
						<CourseElement
							course={adj}
							lists={getCourseLists(requirements, adj.code)}
						/>
					{/each}
				</div>
			</div>
		{/if}
		<div class="ml-3">
			{#if dependants.length > 0}
				<h2 class="pb-1 text-lg font-medium text-content-primary">
					{lang.common.dependants}
				</h2>
				<div class="flex flex-row flex-wrap">
					{#each dependants as c, i}
						<div
							class="container w-fit pb-4 pr-2"
							tabindex={i}
							role="button"
							onclick={() => goto(`/course/${c.code}`)}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									goto(`/course/${c.code}`);
								}
							}}
						>
							<CourseElement
								course={c}
								lists={getCourseLists(requirements, c.code)}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
