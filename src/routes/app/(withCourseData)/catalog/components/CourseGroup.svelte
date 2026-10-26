<script lang="ts">
	import CourseElement from '$lib/components/CourseElement.svelte';
	import LoadingCourseElement from '$lib/components/LoadingCourseElement.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';

	import { content, user } from '$lib/stores.svelte';

	type Props = {
		getCourseData: GetCourseData;
		titles: Requirement[];
		colorize?: boolean;
		codes: string[];
		requirements?: Requirement;
	};
	let {
		getCourseData,
		titles,
		colorize = true,
		codes,
		requirements
	}: Props = $props();

	const groups = $derived.by(async () => {
		const courses = (
			await Promise.all(codes.map((c) => getCourseData(c as CourseCode)))
		)
			.toSorted((a, b) => {
				const medians = (b.median ?? 0) - (a.median ?? 0);

				if (medians !== 0) {
					return medians;
				}

				return (a.code ?? '').localeCompare(b.code ?? '');
			})
			.filter((c) => c.name !== undefined);

		const maxGroupSize = 30;

		const groups: [string, Course[]][] = [];
		for (let i = 0; i < courses.length; i += maxGroupSize) {
			const group = courses.slice(i, i + maxGroupSize);
			const groupMedians = group.map((c) => c.median ?? -1);
			const maxMedian = Math.max(...groupMedians);
			const minMedian = Math.min(...groupMedians);

			const maxStr = maxMedian === -1 ? 'N/A' : maxMedian.toFixed(1);
			const minStr = minMedian === -1 ? 'N/A' : minMedian.toFixed(1);

			const name = maxStr === minStr ? maxStr : `${maxStr} - ${minStr}`;

			groups.push([name, group]);
		}

		// add empty group if no courses, for placeholder rows (like wishlist)
		if (groups.length === 0) {
			groups.push(['', []]);
		}

		return groups;
	});
	const id = $derived(titles.map((t) => t.name.toLowerCase()).join('_'));

	function getCourseSemester(course: Course): number | undefined {
		const index = user.d.semesters.findIndex((s) => s.includes(course.code));

		if (index === -1) {
			return undefined;
		} else {
			return index;
		}
	}

	const seasonEmojis = ['❄️', '🌿', '☀️'];
</script>

<div {id} class="course-group">
	{#await groups}
		<div role="status" aria-label={content.lang.common.loading}>
			<LoadingCourseElement />
		</div>
	{:then groups}
		{#each groups as [scores, group], index}
			<section class="course-group-section">
				<header class="course-group-header">
					<h2 class="course-group-title">
						{#each titles as title, titleIndex}
							{#if titleIndex > 0}<span
									class="course-group-divider"
									aria-hidden="true">/</span
								>{/if}
							<span>{content.lang.lang === 'he' ? title.he : title.en}</span>
						{/each}
					</h2>
					{#if scores}
						<p class="course-group-score">
							<span>{content.lang.course.median}</span>
							<bdi dir="ltr">{scores}</bdi>
							{#if groups.length > 1}
								<bdi dir="ltr">({index + 1}/{groups.length})</bdi>
							{/if}
						</p>
					{/if}
				</header>
				{#if group.length === 0}
					<p class="course-group-empty">
						{content.lang.lang === 'he' ? 'אין קורסים' : 'No courses'}
					</p>
				{:else}
					<CourseRow {getCourseData} courses={group} indent={0}>
						{#snippet children({ code, course })}
							<a href={`/app/course/${code}`}>
								<CourseElement {code} {course}>
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
							</a>
						{/snippet}
					</CourseRow>
				{/if}
			</section>
		{/each}
	{:catch}
		<p role="alert" class="ui-notice course-group-error">
			{content.lang.search.loadError}
		</p>
	{/await}
</div>

<style>
	.course-group {
		max-inline-size: 100%;
		min-inline-size: 0;
	}
	.course-group-section + .course-group-section {
		margin-block-start: 0.875rem;
	}
	.course-group-header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.25rem 0.75rem;
		margin-block-end: 0.5rem;
	}
	.course-group-title {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.5rem;
		min-inline-size: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}
	.course-group-divider {
		color: rgb(var(--color-content-secondary));
		font-weight: 400;
	}
	.course-group-score {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		color: rgb(var(--color-content-secondary));
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}
	.course-group-empty {
		color: rgb(var(--color-content-secondary));
		font-size: 0.8125rem;
	}
	.course-group-error {
		margin: 0;
	}
</style>
