<script lang="ts">
	import { goto, beforeNavigate } from '$app/navigation';

	import { degreeData } from '$lib/stores';
	import { buildGetCourseData } from '$lib/courseData';
	import CourseElement from '$lib/components/CourseElement.svelte';

	import { getCourseLists } from '$lib/requirements';

	import { generateRequirementColor } from '$lib/colors';

	export let titles: string[];
	export let colorize: boolean = true;
	export let codes: string[];

	const { abort, getCourseData } = buildGetCourseData();

	beforeNavigate(() => {
		abort();
	});

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	async function getCourseGroups(
		codes: string[]
	): Promise<[string, Course[]][]> {
		const courses = await Promise.all(codes.map((c) => getCourseData(c))).then(
			(courses) =>
				courses
					.toSorted((a, b) => {
						const medians = (b.median ?? 0) - (a.median ?? 0);

						if (medians !== 0) {
							return medians;
						}

						return (a.code ?? '').localeCompare(b.code ?? '');
					})
					.filter((c) => c.name !== undefined)
		);

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
				class="mb-2 flex flex-row items-baseline space-x-4 text-2xl font-medium text-content-primary"
			>
				<div class="flex flex-row items-baseline space-x-2">
					{#each titles as title}
						{#if colorize}
							<div
								style="background: {generateRequirementColor(title)}"
								class="h-4 w-4 rounded-full"
							/>
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
						class="container w-fit"
						tabindex={i}
						role="button"
						on:click={() => goto(`/course/${course.code}`)}
						on:keydown={(e) => {
							if (e.key === 'Enter') {
								goto(`/course/${course.code}`);
							}
						}}
					>
						<CourseElement
							{course}
							requirements={$degreeData?.then((d) =>
								getCourseLists(d.requirements, course.code).filter(
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
