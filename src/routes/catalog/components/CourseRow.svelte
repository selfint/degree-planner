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
		requirements?: DegreeRequirements;
	};

	function formatName(name: string): string {
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

	let { titles, colorize = true, codes, requirements }: Props = $props();

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

		if (groups.length === 0) {
			groups.push(['', []]);
		}

		return groups;
	});
	const id = titles.map((t) => t.toLowerCase()).join('_');
</script>

<div {id} class="mb-4 min-h-[118px] max-w-full">
	{#each groups as [name, group]}
		<h1
			class="mb-2 ml-3 mr-3 flex flex-row items-baseline text-lg font-medium text-content-primary"
		>
			<div class="flex flex-row flex-wrap items-baseline">
				{#each titles as title}
					{#if colorize}
						<span
							class="mb-1 mr-1 w-fit rounded-md pl-2 pr-2 text-content-primary"
							style="background: {generateRequirementColor(title)}"
						>
							{formatName(title)}
						</span>
					{:else}
						<span class="mr-1">{formatName(title)}</span>
					{/if}
				{/each}
			</div>
		</h1>
		<div class="mb-4 flex w-full flex-row overflow-x-auto">
			<div class="min-w-3"></div>
			{#each group as course, i}
				<div
					class="w-fit touch-manipulation pr-2"
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
						lists={getCourseLists(requirements, course.code).filter(
							(list) => !titles.includes(list)
						)}
					/>
				</div>
			{/each}
		</div>
	{/each}
</div>
