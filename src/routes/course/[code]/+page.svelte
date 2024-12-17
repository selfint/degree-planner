<script lang="ts">
	import { page } from '$app/stores';

	import Button from '$lib/components/Button.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';

	import { user, catalog, content } from '$lib/stores.svelte';

	import { getCourseData, getAllCourses } from '$lib/courseData';
	import { getCourseLists } from '$lib/requirements';
	import { generateCourseColor } from '$lib/colors';
	import RequirementsElement from '$lib/components/RequirementsElement.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';

	const code = $derived($page.params.code);
	const course = $derived(getCourseData(code));
	const requirements = $derived(catalog()?.requirement);

	const courseMemberRequirements = $derived.by(() => {
		if (requirements === undefined) {
			return [];
		}

		return getCourseLists(requirements, code);
	});

	const dependencies = $derived(
		course.connections?.dependencies.filter((g) => g.length > 0) ?? []
	);

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

	function formatRequirementName(requirement: Requirement): string {
		let name = requirement.name;
		if (requirement.he !== undefined && content.lang.lang === 'he') {
			name = requirement.he;
		}
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
		const season = content.lang.common.seasons[semesterIndex % 3];
		const modIndex = Math.floor(semesterIndex / 3) + 1;
		return `${season} ${modIndex}`;
	}

	let depRow: HTMLDivElement;
	$effect(() => {
		if (depRow) {
			// hack to get this effect to run each time the course changes
			depRow.scrollLeft = code.length - code.length;
		}
	});
</script>

<div class="mt-3">
	<h1 class="ms-3 text-lg font-medium text-content-primary">
		<div class="flex flex-row flex-wrap items-center gap-x-1 leading-tight">
			<div class="m-0 mb-1 mt-1 p-0">
				<div
					style="background: {generateCourseColor(course)}"
					class="h-4 w-4 rounded-full"
				></div>
			</div>
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
		</div>
	</h1>

	<div class="mb-4 ms-3 flex flex-row flex-wrap items-center space-y-1">
		<RequirementsElement requirements={courseMemberRequirements} />
	</div>

	<p class="mb-8 ml-3 mr-3 text-content-secondary" dir="rtl">
		{course.about}
	</p>

	<div class="ml-3 mr-3 space-x-1">
		{#if user.semesters.some((s) => s.includes(course.code))}
			<Button
				variant="secondary"
				onclick={() => removeCourseFromSemesters(course.code)}
			>
				{content.lang.course.removeFromSemester}
				{getSeasonAndIndex(
					user.semesters.findIndex((s) => s.includes(course.code))
				)}
			</Button>
		{:else}
			<Button variant="primary" onclick={() => planCourse(course.code)}>
				{content.lang.course.plan}
			</Button>
			{#if user.wishlist.includes(course.code)}
				<Button
					variant="secondary"
					onclick={() =>
						(user.wishlist = user.wishlist.filter((c) => c !== course.code))}
				>
					{content.lang.course.removeFromWishlist}
				</Button>
			{:else}
				<Button
					variant="secondary"
					onclick={() =>
						(user.wishlist = [...new Set([...user.wishlist, course.code])])}
				>
					{content.lang.course.wishlist}
				</Button>
			{/if}
		{/if}
	</div>

	<div class="ms-3 mt-4">
		<h2 class="text-lg font-medium text-content-primary">
			{content.lang.course.info}
		</h2>
		<div
			class="grid w-fit grid-flow-row grid-cols-[auto_auto] items-center gap-x-2 text-content-secondary"
		>
			<span>{content.lang.common.faculty}</span>
			<span>{course.faculty ?? content.lang.common.na}</span>
			<span>{content.lang.course.median}</span>
			<span>{course.median ?? content.lang.common.na}</span>
			<span>{content.lang.course.points}</span>
			<span>{course.points ?? content.lang.common.na}</span>
			<span>{content.lang.course.available}</span>
			<span>
				{course?.current ? content.lang.common.yes : content.lang.common.no}
			</span>
		</div>
	</div>

	<div class="mt-4">
		{#if dependencies.length !== 0}
			<div class="pb-4">
				<h2 class="ms-3 pb-1 text-lg font-medium text-content-primary">
					{content.lang.common.dependencies}
				</h2>
				<div
					bind:this={depRow}
					dir={content.lang.dir}
					class="flex flex-row overflow-x-auto"
				>
					<div class="me-3"></div>
					{#each dependencies as group, i}
						{#if i !== 0}
							<p
								class="flex flex-col justify-center pe-2 text-sm font-light text-content-secondary"
							>
								{content.lang.common.or}
							</p>
						{/if}
						<div class="flex flex-col space-y-1">
							{#each group.map(getCourseData) as dep}
								<a class="pe-2" href={`/course/${dep.code}`}>
									<CourseElement course={dep} />
								</a>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}
		{#if (course.connections?.adjacent ?? []).length !== 0}
			<div class="pb-4">
				<h2 class="ms-3 pb-1 text-lg font-medium text-content-primary">
					{content.lang.common.adjacencies}
				</h2>
				<div class="flex flex-row space-x-2 overflow-x-auto">
					<CourseRow resetScroll courses={course.connections?.adjacent ?? []}>
						{#snippet children({ course })}
							<a href={`/course/${course.code}`}>
								<CourseElement {course} />
							</a>
						{/snippet}
					</CourseRow>
				</div>
			</div>
		{/if}
		{#if (course.connections?.exclusive ?? []).length !== 0}
			<div class="pb-4">
				<h2 class="ms-3 pb-1 text-lg font-medium text-content-primary">
					{content.lang.common.exclusives}
				</h2>
				<CourseRow resetScroll courses={course.connections?.exclusive ?? []}>
					{#snippet children({ course })}
						<a href={`/course/${course.code}`}>
							<CourseElement {course} />
						</a>
					{/snippet}
				</CourseRow>
			</div>
		{/if}
		<div class="ms-3">
			{#if dependants.length > 0}
				<h2 class="pb-1 text-lg font-medium text-content-primary">
					{content.lang.common.dependants}
				</h2>
				<div class="flex flex-row flex-wrap">
					{#each dependants as c}
						<a class="pb-4 pe-2" href={`/course/${c.code}`}>
							<CourseElement course={c} />
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
