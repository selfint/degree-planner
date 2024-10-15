<script lang="ts">
	import { goto } from '$app/navigation';

	import { getCourseData } from '$lib/courseData';
	import CourseElement from '$lib/components/CourseElement.svelte';

	import { getCourseLists } from '$lib/requirements';

	import { generateRequirementColor } from '$lib/colors';

	type Props = {
		titles: string[];
		colorize?: boolean;
		codes: string[];
		degreeRequirements?: Promise<DegreeRequirements>;
	};

	let { titles, colorize = true, codes, degreeRequirements }: Props = $props();

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	async function getCourseGroups(
		codes: string[]
	): Promise<[string, Course[]][]> {
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

		if (groups.length === 0) {
			groups.push(['', []]);
		}

		return groups;
	}
</script>

<div class="mb-4 min-h-[118px] max-w-full">
	{#await getCourseGroups(codes)}
		<div class="text-content-secondary">Loading...</div>
	{:then groups}
		{#each groups as [name, group]}
			<h1
				class="mb-2 flex flex-row items-baseline space-x-4 text-lg font-medium text-content-primary"
			>
				<div class="flex flex-row items-baseline space-x-2">
					{#each titles as title}
						{#if colorize}
							<div
								style="background: {generateRequirementColor(title)}"
								class="h-4 w-4 min-w-4 rounded-full"
							></div>
						{/if}
						<span class="w-fit pr-2">
							{formatName(title)}
						</span>
					{/each}
				</div>

				<span class="ml-2 font-normal text-content-secondary">
					{name}
				</span>
			</h1>
			<div class="mb-4 flex w-full flex-row space-x-2 overflow-x-auto">
				{#each group as course, i}
					<div
						class="container w-fit touch-manipulation"
						tabindex={i}
						role="button"
						onmousedown={() => goto(`/course/${course.code}`)}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								goto(`/course/${course.code}`);
							}
						}}
					>
						<CourseElement
							{course}
							lists={degreeRequirements?.then((r) =>
								getCourseLists(r, course.code).filter(
									(list) => !titles.includes(list)
								)
							)}
						/>
					</div>
				{/each}
			</div>
		{/each}
	{/await}
</div>
