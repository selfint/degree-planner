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

<div {id} class="mb-2 min-h-[118px] max-w-full">
	{#await groups}
		<div role="status" aria-label={content.lang.common.loading}>
			<LoadingCourseElement />
		</div>
	{:then groups}
		{#each groups as [scores, group], index}
			<div class="mb-2">
				<h1
					class="mb-2 me-3 ms-3 flex flex-row items-baseline text-base font-medium text-content-primary"
				>
					<div class="me-2 flex flex-col flex-wrap items-start gap-y-1">
						{#each titles as title}
							<span class="me-1 leading-none">
								{content.lang.lang === 'he' ? title.he : title.en}
							</span>
						{/each}
					</div>

					<div class="flex-grow sm:ms-3 sm:flex-grow-0"></div>
					<span
						class="flex flex-row text-nowrap font-normal text-content-secondary"
					>
						<span>
							{scores}
						</span>
						{#if groups.length > 1}
							<span class="ms-1">
								({index + 1}/{groups.length})
							</span>
						{/if}
					</span>
				</h1>
				<CourseRow {getCourseData} courses={group}>
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
			</div>
		{/each}
	{:catch}
		<p role="alert" class="text-content-secondary">
			{content.lang.search.loadError}
		</p>
	{/await}
</div>
