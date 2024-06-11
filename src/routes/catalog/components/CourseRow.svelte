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
</script>

<div class="mb-4 min-h-[118px] max-w-full">
	<h1
		class="mb-2 flex w-full max-w-full flex-row space-x-1 font-medium text-content-primary"
	>
		{#each titles as title}
			<div
				style={colorize ? 'background: ' + generateRequirementColor(title) : ''}
				class="rounded-md pb-0.5 pl-2 pr-2 leading-none"
			>
				<span class="w-fit leading-none">
					{formatName(title)}
				</span>
			</div>
		{/each}
	</h1>
	<div class="flex w-full flex-row space-x-2 overflow-x-auto">
		{#await Promise.all(codes.map(getCourseData)).then( (courses) => courses.toSorted((a, b) => (b.median ?? 0) - (a.median ?? 0)) )}
			<div class="text-content-secondary">Loading...</div>
		{:then courses}
			{#each courses as course, i}
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
		{/await}
	</div>
</div>
