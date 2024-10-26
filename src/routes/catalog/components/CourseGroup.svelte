<script lang="ts">
	import { getCourseData } from '$lib/courseData';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';

	import { getCourseLists } from '$lib/requirements';
	import { content, user } from '$lib/stores.svelte';

	import RequirementsElement from '$lib/components/RequirementsElement.svelte';

	type Props = {
		titles: Requirement[];
		colorize?: boolean;
		codes: string[];
		requirements?: Requirement;
	};
	let { titles, colorize = true, codes, requirements }: Props = $props();

	function formatName(requirement: Requirement): string {
		let name = requirement.name;
		if (content.lang.lang === 'he' && requirement.he !== undefined) {
			name = requirement.he;
		}

		return (
			name[0].toUpperCase() +
			name
				.slice(1)
				.toLowerCase()
				.split('_')
				.map((word) => (word.length > 2 ? word : word.toUpperCase()))
				.join(' ')
		);
	}

	const groups = $derived.by(() => {
		const courses = codes
			.map((c) => getCourseData(c))
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
	const id = titles.map((t) => t.name.toLowerCase()).join('_');

	function getCourseSemester(course: Course): number | undefined {
		const index = user.semesters.findIndex((s) => s.includes(course.code));

		if (index === -1) {
			return undefined;
		} else {
			return index;
		}
	}

	const seasonEmojis = ['❄️', '🌿', '☀️'];
</script>

<div {id} class="mb-4 min-h-[118px] max-w-full">
	{#each groups as [scores, group]}
		<div class="mb-4">
			<h1
				class="mb-1 me-3 ms-3 flex flex-row items-baseline text-lg font-medium text-content-primary"
			>
				{#if colorize}
					<RequirementsElement requirements={[titles]} />
				{:else}
					<div class="me-2 flex flex-row flex-wrap items-baseline">
						{#each titles as title}
							<span class="me-1">{formatName(title)}</span>
						{/each}
					</div>
				{/if}

				<div class="flex-grow sm:ms-3 sm:flex-grow-0"></div>
				<span dir="ltr" class="text-nowrap font-normal text-content-secondary">
					{scores}
				</span>
			</h1>
			<CourseRow courses={group}>
				{#snippet children({ course })}
					<a href={`/course/${course.code}`}>
						<CourseElement
							{course}
							lists={getCourseLists(requirements, course.code).filter(
								(list) => !list.every((req, i) => req.name === titles[i]?.name)
							)}
						>
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
										{formatName({ name: content.lang.catalog.wishlist })}
									</span>
								{/if}
							{/snippet}
						</CourseElement>
					</a>
				{/snippet}
			</CourseRow>
		</div>
	{/each}
</div>
