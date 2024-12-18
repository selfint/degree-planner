<script lang="ts">
	import { user, catalog, content } from '$lib/stores.svelte';
	import { getDegreeRequirementCourses } from '$lib/requirements';
	import { getCourseData } from '$lib/courseData';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';

	const requirements = $derived(catalog()?.requirement);

	const lists = $derived.by(() => {
		if (requirements === undefined) {
			return [];
		}

		return getDegreeRequirementCourses(requirements);
	});

	function getCourseSemester(course: Course): number | undefined {
		const index = user.semesters.findIndex((s) => s.includes(course.code));

		if (index === -1) {
			return undefined;
		} else {
			return index;
		}
	}

	const seasonEmojis = ['❄️', '🌿', '☀️'];

	const planned = $derived(user.semesters);
	const current = $derived(planned.slice(0, user.currentSemester));
</script>

<div class="mt-3">
	<div class="mb-7">
		<h1
			class="text-md mb-1 me-3 ms-3 flex flex-row items-baseline font-medium text-content-primary"
		>
			<div class="me-2 flex flex-col flex-wrap items-start gap-y-1">
				<span class="me-1">
					{content.lang.catalog.wishlist}
				</span>
			</div>
		</h1>
		<CourseRow courses={user.wishlist}>
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
							{:else if user.wishlist.includes(course.code)}
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
			{@const listPlanned = list.courses.filter((c) =>
				planned.flat().includes(c)
			)}
			{@const listCurrent = list.courses.filter((c) =>
				current.flat().includes(c)
			)}
			{@const countCurrent = listCurrent.length}
			{@const countPlanned = listPlanned.length}
			{@const pointsCurrent = listCurrent
				.map(getCourseData)
				.reduce((sum, { points }) => sum + (points ?? 0), 0)}
			{@const pointsPlanned = listPlanned
				.map(getCourseData)
				.reduce((sum, { points }) => sum + (points ?? 0), 0)}

			<div class="mb-7 flex flex-col gap-y-1">
				<h1
					class="text-md me-3 ms-3 flex flex-row items-baseline font-medium text-content-primary"
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
						<span class="me-2">{content.lang.progress.count}</span>
						<ProgressBar
							value={countCurrent}
							value2={countPlanned}
							max={countPlanned}
							dir={content.lang.dir}
						/>
						<span class="ms-2 text-nowrap">
							<span class="text-accent-primary">{countCurrent}</span> / {countPlanned}
						</span>
					</div>
					<div
						class="ms-3 flex flex-row items-center pe-2 text-content-secondary"
					>
						<span class="me-2">{content.lang.progress.points}</span>
						<ProgressBar
							value={pointsCurrent}
							value2={pointsPlanned}
							max={pointsPlanned}
							dir={content.lang.dir}
						/>
						<span class="ms-2 text-nowrap">
							<span class="text-accent-primary">{pointsCurrent}</span> / {pointsPlanned}
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
									{:else if user.wishlist.includes(course.code)}
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
