<script lang="ts">
	import { user, content, requirement } from '$lib/stores.svelte';
	import { getDegreeRequirementCourses } from '$lib/requirements';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { goto } from '$app/navigation';
	import Spinner from '$lib/components/Spinner.svelte';

	const { data: pageData } = $props();
	const { getCourseData } = pageData;

	const lists = $derived.by(async () => {
		const r = requirement();
		if (r === undefined) {
			return [];
		}

		return getDegreeRequirementCourses(await r);
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
	const totalCurrentPoints = $derived.by(() =>
		Promise.all(current.map(getCourseData)).then((p) =>
			p.reduce((sum, { points }) => sum + (points ?? 0), 0)
		)
	);
	const totalPlannedPoints = $derived.by(() =>
		Promise.all(planned.map(getCourseData)).then((p) =>
			p.reduce((sum, { points }) => sum + (points ?? 0), 0)
		)
	);

	const catalogName = $derived(
		content.lang.lang === 'en' ? 'catalog' : 'קטלוג'
	);

	const degreeName = $derived.by(async () => {
		if (user.d.degree === undefined) {
			return '';
		}

		const lang = content.lang.lang;

		const [year, faculty, degree] = user.d.degree;
		const path = user.d.path;

		const _fetch = (values: string[]) =>
			fetch(['/_catalogs', ...values, lang].join('/')).then((r) => r.text());

		const _yearName = _fetch([year]);
		const _facultyName = _fetch([year, faculty]);
		const _degreeName = _fetch([year, faculty, degree]);

		if (path === undefined) {
			const [yearName, facultyName, degreeName] = await Promise.all([
				_yearName,
				_facultyName,
				_degreeName
			]);
			return `${facultyName} (${catalogName} ${yearName}) - ${degreeName}`;
		} else {
			const [yearName, facultyName, degreeName, pathName] = await Promise.all([
				_yearName,
				_facultyName,
				_degreeName,
				_fetch([year, faculty, degree, 'requirement', path])
			]);
			return `${facultyName} (${catalogName} ${yearName}) - ${degreeName} ${pathName}`;
		}
	});
</script>

<div class="mt-3">
	{#if degreeName !== undefined}
		<div class="mb-7">
			<h1
				class="mb-1 me-3 ms-3 flex flex-row items-baseline text-base font-medium text-content-primary"
			>
				<div class="me-2 flex flex-row flex-wrap items-start gap-y-1">
					{#await degreeName}
						{content.lang.common.loading}
						{catalogName}
						<div class="me-1 inline h-5 w-5">
							<Spinner />
						</div>
					{:then degreeName}
						{degreeName}
					{/await}
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
						<ProgressBar value={1} value2={2} max={3} dir={content.lang.dir} />
						<div class="w-full max-w-6">
							<Spinner />
						</div>
					{:then [totalCurrentPoints, totalPlannedPoints]}
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
					{/await}
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
			{#snippet children({ code, course, index })}
				<button onclick={() => goto(`/course/${code}`)}>
					<CourseElement
						{code}
						{course}
						{index}
						styleOnCourse={(c) =>
							Promise.resolve(c.current ? '' : 'opacity: 0.6')}
					>
						{#snippet note(course)}
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
	{#await lists}
		<div class="h-7 w-7">
			<Spinner />
		</div>
	{:then lists}
		{#each lists as list}
			{#if list.courses.length > 0}
				{@const listPlanned = list.courses.filter((c) => planned.includes(c))}
				{@const listCurrent = list.courses.filter((c) => current.includes(c))}
				{@const countCurrent = listCurrent.length}
				{@const countPlanned = listPlanned.length}
				{@const countTotal = list.courses.length}
				{@const pointsCurrent = Promise.all(
					listCurrent.map(getCourseData)
				).then((p) => p.reduce((sum, { points }) => sum + (points ?? 0), 0))}
				{@const pointsPlanned = Promise.all(
					listPlanned.map(getCourseData)
				).then((p) => p.reduce((sum, { points }) => sum + (points ?? 0), 0))}
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
									value={1}
									value2={2}
									max={3}
									dir={content.lang.dir}
								/>
								<div class="w-full max-w-6">
									<Spinner />
								</div>
							{:then [pointsCurrent, pointsPlanned, pointsTotal]}
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
							{/await}
						</div>
					</div>

					<CourseRow {getCourseData} courses={list.courses}>
						{#snippet children({ code, course, index })}
							<button
								class:opacity-60={false}
								onclick={() => goto(`/course/${code}`)}
							>
								<CourseElement {code} {course} {index}>
									{#snippet note(course)}
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
	{/await}
</div>
