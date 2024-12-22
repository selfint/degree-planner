<script lang="ts">
	import { user, catalog, content } from '$lib/stores.svelte';
	import { getDegreeRequirementCourses } from '$lib/requirements';
	import { getCourseData } from '$lib/courseData';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import catalogs from '$lib/assets/catalogs.json';

	const requirements = $derived(catalog()?.requirement);

	const lists = $derived.by(() => {
		if (requirements === undefined) {
			return [];
		}

		return getDegreeRequirementCourses(requirements);
	});

	function getCourseSemester(course: Course): number | undefined {
		const index = user.d.semesters.findIndex((s) => s.includes(course.code));

		if (index === -1) {
			return undefined;
		} else {
			return index;
		}
	}

	const seasonEmojis = ['❄️', '🌿', '☀️'];

	const planned = $derived([...user.d.semesters.flat(), ...user.d.exemptions]);
	const current = $derived([
		...user.d.semesters.slice(0, user.d.currentSemester).flat(),
		...user.d.exemptions
	]);

	function applyI18n(i18n: I18N): string {
		let name = i18n.en;
		if (content.lang.lang === 'he') {
			name = i18n.he;
		}

		return name;
	}

	const totalCurrentCount = $derived(current.length);
	const totalPlannedCount = $derived(planned.length);
	const totalCurrentPoints = $derived(
		current
			.map(getCourseData)
			.reduce((sum, { points }) => sum + (points ?? 0), 0)
	);
	const totalPlannedPoints = $derived(
		planned
			.map(getCourseData)
			.reduce((sum, { points }) => sum + (points ?? 0), 0)
	);
	const degreeName = $derived.by(() => {
		const degree = user.d.degree;
		if (degree === undefined) {
			return undefined;
		}
		let year = applyI18n(catalogs[degree[0]]);
		let faculty = applyI18n(catalogs[degree[0]][degree[1]]);
		// @ts-expect-error
		let path = applyI18n(catalogs[degree[0]][degree[1]][degree[2]]);

		if (user.d.path === undefined) {
			return `${faculty} (${content.lang.preview.catalog} ${year}) - ${path}`;
		}

		// @ts-expect-error
		let userPathNested = catalogs[degree[0]][degree[1]][
			degree[2]
		].requirement.nested.find((n: Requirement) => n.name === user.d.path);

		const userPathName = applyI18n(userPathNested);

		return `${faculty} (${content.lang.preview.catalog} ${year}) - ${path} ${userPathName}`;
	});
</script>

<div class="mt-3">
	{#if degreeName !== undefined}
		<div class="mb-7">
			<h1
				class="mb-1 me-3 ms-3 flex flex-row items-baseline text-base font-medium text-content-primary"
			>
				<div class="me-2 flex flex-col flex-wrap items-start gap-y-1">
					<span class="me-1">
						{degreeName}
					</span>
				</div>
			</h1>
			<div class="max-w-[30rem]">
				<div
					class="ms-3 flex flex-row items-center pe-2 text-content-secondary"
				>
					<span class="me-2">{content.lang.settings.count}</span>
					<ProgressBar
						value={totalCurrentCount}
						value2={totalPlannedCount}
						max={totalPlannedCount}
						dir={content.lang.dir}
					/>
					<span class="ms-2 text-nowrap">
						<span class="text-accent-primary">{totalCurrentCount}</span>
						/ {totalPlannedCount}
					</span>
				</div>
				<div
					class="ms-3 flex flex-row items-center pe-2 text-content-secondary"
				>
					<span class="me-2">{content.lang.settings.points}</span>
					<ProgressBar
						value={totalCurrentPoints}
						value2={totalPlannedPoints}
						max={totalPlannedPoints}
						dir={content.lang.dir}
					/>
					<span class="ms-2 text-nowrap">
						<span class="text-accent-primary">{totalCurrentPoints}</span>
						/ {totalPlannedPoints}
					</span>
				</div>
			</div>
		</div>
	{/if}

	<div class="mb-7">
		<h1
			class="mb-1 me-3 ms-3 flex flex-row items-baseline text-base font-medium text-content-primary"
		>
			<div class="me-2 flex flex-col flex-wrap items-start gap-y-1">
				<span class="me-1">
					{content.lang.catalog.wishlist}
				</span>
			</div>
		</h1>
		<CourseRow courses={user.d.wishlist}>
			{#snippet children({ course })}
				<a href={`/course/${course.code}`}>
					<CourseElement {course}>
						{#snippet note()}
							{@const index = getCourseSemester(course)}
							{#if index !== undefined}
								<span>
									{seasonEmojis[index % 3]}
									<span class="hidden sm:inline">
										{content.lang.common.seasons[index % 3]}
										{Math.floor(index / 3) + 1}
									</span>
								</span>
							{:else if user.d.exemptions.includes(course.code)}
								<span>✓</span>
								<span class="hidden sm:inline">
									{content.lang.catalog.exempt}
								</span>
							{:else if user.d.wishlist.includes(course.code)}
								<span>🌟</span>
								<span class="hidden sm:inline">
									{content.lang.catalog.wishlist}
								</span>
							{/if}
						{/snippet}
					</CourseElement>
				</a>
			{/snippet}
		</CourseRow>
	</div>
	{#each lists as list}
		{#if list.courses.length > 0}
			{@const listPlanned = list.courses.filter((c) => planned.includes(c))}
			{@const listCurrent = list.courses.filter((c) => current.includes(c))}
			{@const countCurrent = listCurrent.length}
			{@const countPlanned = listPlanned.length}
			{@const countTotal = list.courses.length}
			{@const pointsCurrent = listCurrent
				.map(getCourseData)
				.reduce((sum, { points }) => sum + (points ?? 0), 0)}
			{@const pointsPlanned = listPlanned
				.map(getCourseData)
				.reduce((sum, { points }) => sum + (points ?? 0), 0)}
			{@const pointsTotal = list.courses
				.map(getCourseData)
				.reduce((sum, { points }) => sum + (points ?? 0), 0)}

			<div class="mb-7 flex flex-col gap-y-1">
				<h1
					class="me-3 ms-3 flex flex-row items-baseline text-base font-medium text-content-primary"
				>
					<div class="me-2 flex flex-row flex-wrap items-start gap-y-1">
						{#each list.path as title}
							<span class="me-1 leading-none">
								{content.lang.lang === 'he' ? title.he : title.en}
							</span>
						{/each}
					</div>
				</h1>

				<div class="max-w-[30rem]">
					<div
						class="ms-3 flex flex-row items-center pe-2 text-content-secondary"
					>
						<span class="me-2">{content.lang.settings.count}</span>
						<ProgressBar
							value={countCurrent}
							value2={countPlanned}
							max={countTotal}
							dir={content.lang.dir}
						/>
						<span class="ms-2 text-nowrap">
							<span class="text-accent-primary">{countCurrent}</span>
							/ {countPlanned}
							/ {countTotal}
						</span>
					</div>
					<div
						class="ms-3 flex flex-row items-center pe-2 text-content-secondary"
					>
						<span class="me-2">{content.lang.settings.points}</span>
						<ProgressBar
							value={pointsCurrent}
							value2={pointsPlanned}
							max={pointsTotal}
							dir={content.lang.dir}
						/>
						<span class="ms-2 text-nowrap">
							<span class="text-accent-primary">{pointsCurrent}</span>
							/ {pointsPlanned}
							/ {pointsTotal}
						</span>
					</div>
				</div>

				<CourseRow courses={list.courses}>
					{#snippet children({ course })}
						<a href={`/course/${course.code}`}>
							<CourseElement {course}>
								{#snippet note()}
									{@const index = getCourseSemester(course)}
									{#if index !== undefined}
										<span>
											{seasonEmojis[index % 3]}
											<span class="hidden sm:inline">
												{content.lang.common.seasons[index % 3]}
												{Math.floor(index / 3) + 1}
											</span>
										</span>
									{:else if user.d.exemptions.includes(course.code)}
										<span>✓</span>
										<span class="hidden sm:inline">
											{content.lang.catalog.exempt}
										</span>
									{:else if user.d.wishlist.includes(course.code)}
										<span>🌟</span>
										<span class="hidden sm:inline">
											{content.lang.catalog.wishlist}
										</span>
									{/if}
								{/snippet}
							</CourseElement>
						</a>
					{/snippet}
				</CourseRow>
			</div>
		{/if}
	{/each}
</div>
