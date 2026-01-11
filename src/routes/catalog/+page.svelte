<script lang="ts">
	import { user, catalog, content } from '$lib/stores.svelte';
	import { getDegreeRequirementCourses } from '$lib/requirements';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { goto } from '$app/navigation';

	const { data: pageData } = $props();
	const { getCourseData, courseData } = pageData;

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

	const totalCurrentCount = $derived(current.length);
	const totalPlannedCount = $derived(planned.length);
	const totalCurrentPoints = $derived(
		Promise.all(current.map(getCourseData)).then((p) =>
			p.reduce((sum, { points }) => sum + (points ?? 0), 0)
		)
	);
	const totalPlannedPoints = $derived(
		Promise.all(planned.map(getCourseData)).then((p) =>
			p.reduce((sum, { points }) => sum + (points ?? 0), 0)
		)
	);
	const degreeName = $derived.by(() => {
		const i18n = catalog()?.i18n;
		if (i18n === undefined) {
			return '';
		}

		let name = i18n.en;
		if (content.lang.lang === 'he') {
			name = i18n.he;
		}

		return name;
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
					{#await Promise.all([totalCurrentPoints, totalPlannedPoints])}
						<ProgressBar
							value={-1}
							value2={-1}
							max={-1}
							dir={content.lang.dir}
						/>
					{:then [totalCurrentPoints, totalPlannedPoints]}
						<ProgressBar
							value={totalCurrentPoints}
							value2={totalPlannedPoints}
							max={totalPlannedPoints}
							dir={content.lang.dir}
						/>
					{/await}
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
		<CourseRow {getCourseData} courses={user.d.wishlist}>
			{#snippet children({ course })}
				<button
					class:opacity-60={!course.current}
					onclick={() => goto(`/course/${course.code}`)}
				>
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
				</button>
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
			{@const pointsCurrent = Promise.all(listCurrent.map(getCourseData)).then(
				(p) => p.reduce((sum, { points }) => sum + (points ?? 0), 0)
			)}
			{@const pointsPlanned = Promise.all(listPlanned.map(getCourseData)).then(
				(p) => p.reduce((sum, { points }) => sum + (points ?? 0), 0)
			)}
			{@const pointsTotal = Promise.all(list.courses.map(getCourseData)).then(
				(p) => p.reduce((sum, { points }) => sum + (points ?? 0), 0)
			)}

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
						{#await Promise.all([pointsCurrent, pointsPlanned, pointsTotal])}
							<ProgressBar
								value={-1}
								value2={-1}
								max={-1}
								dir={content.lang.dir}
							/>
						{:then [pointsCurrent, pointsPlanned, pointsTotal]}
							<ProgressBar
								value={pointsCurrent}
								value2={pointsPlanned}
								max={pointsTotal}
								dir={content.lang.dir}
							/>
						{/await}
						<span class="ms-2 text-nowrap">
							<span class="text-accent-primary">{pointsCurrent}</span>
							/ {pointsPlanned}
							/ {pointsTotal}
						</span>
					</div>
				</div>

				<CourseRow {getCourseData} courses={list.courses}>
					{#snippet children({ course })}
						<button
							class:opacity-60={!course.current}
							onclick={() => goto(`/course/${course.code}`)}
						>
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
						</button>
					{/snippet}
				</CourseRow>
			</div>
		{/if}
	{/each}
</div>
