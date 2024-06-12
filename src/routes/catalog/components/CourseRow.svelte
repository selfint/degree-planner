<script lang="ts">
	import { goto } from '$app/navigation';

	import { degreeData } from '$lib/stores';
	import { getCourseData } from '$lib/courseData';
	import CourseElement from '$lib/components/CourseElement.svelte';

	import { getCourseLists } from '$lib/requirements';

	import { generateRequirementColor } from '$lib/colors';

	export let titles: string[];
	export let colorize: boolean = true;
	export let codes: string[];

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	async function getCourseGroups(
		codes: string[]
	): Promise<[string, Course[]][]> {
		const courses = await Promise.all(codes.map(getCourseData)).then(
			(courses) => courses.toSorted((a, b) => (b.median ?? 0) - (a.median ?? 0))
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

		return groups;
	}
</script>

<div class="mb-4 min-h-[118px] max-w-full">
	{#await getCourseGroups(codes)}
		<div class="text-content-secondary">Loading...</div>
	{:then groups}
		{#each groups as [name, group]}
			<h1
				class="mb-2 flex w-full max-w-full flex-row items-baseline space-x-1 font-medium text-content-primary"
			>
				{#each titles as title}
					<div
						style={colorize
							? 'background: ' + generateRequirementColor(title)
							: ''}
						class="h-fit rounded-md pb-0.5 pl-2 pr-2 leading-none"
					>
						<span class="w-fit leading-none">
							{formatName(title)}
						</span>
					</div>
				{/each}

				<div>
					<span class="text-content-secondary">{name}</span>
				</div>
			</h1>
			<div class="mb-2 flex w-full flex-row space-x-2 overflow-x-auto">
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
