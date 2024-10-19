<script lang="ts">
	import { getCourseData } from '$lib/courseData';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';

	import { getCourseLists } from '$lib/requirements';

	import { generateRequirementColor } from '$lib/colors';

	type Props = {
		titles: string[];
		colorize?: boolean;
		codes: string[];
		requirements?: Requirement;
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

		return groups;
	});
	const id = titles.map((t) => t.toLowerCase()).join('_');
</script>

<div {id} class="mb-4 min-h-[118px] max-w-full">
	{#each groups as [scores, group]}
		<div class="mb-4">
			<h1
				class="mb-1 ms-3 flex flex-row items-baseline text-lg font-medium text-content-primary"
			>
				<div class="me-2 flex flex-row flex-wrap items-baseline">
					{#each titles as title}
						{#if colorize}
							<span
								class="mb-1 me-1 w-fit rounded-md pl-2 pr-2 text-content-primary"
								style="background: {generateRequirementColor(title)}"
							>
								{formatName(title)}
							</span>
						{:else}
							<span class="me-1">{formatName(title)}</span>
						{/if}
					{/each}
				</div>

				<span dir="ltr" class="font-normal text-content-secondary">
					{scores}
				</span>
			</h1>
			<CourseRow courses={group}>
				{#snippet children({ course })}
					<a href={`/course/${course.code}`}>
						<CourseElement
							{course}
							lists={getCourseLists(requirements, course.code)}
						/>
					</a>
				{/snippet}
			</CourseRow>
		</div>
	{/each}
</div>
