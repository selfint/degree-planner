<script lang="ts">
	import { page } from '$app/stores';
	import { getCourseData } from '$lib/courseData';

	import { degreeData, wishlist } from '$lib/stores';

	import { getCourseLists } from '$lib/requirements';

	import { generateRequirementColor, generateCourseColor } from '$lib/colors';
	import Button from '$lib/components/Button.svelte';

	// get code from path params
	const { code } = $page.params;

	const requirements = $degreeData?.then((d) =>
		getCourseLists(d.requirements, code)
	);

	function formatCourseName(name: string): string {
		return name.split('-').at(1) ?? name;
	}

	function formatRequirementName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}
</script>

{#await getCourseData(code)}
	<p class="text-content-primary">Loading...</p>
{:then course}
	<h1 class="mb-2 text-2xl font-medium text-content-primary">
		<span dir="rtl">
			{formatCourseName(course.name ?? code)}
		</span>

		<span class="text-content-secondary">
			{course.code}
		</span>
	</h1>

	<div class="mb-4 flex flex-row items-center space-x-1">
		<div class="m-0 ml-1 p-0">
			<div
				style="background: {generateCourseColor(course)}"
				class="h-8 w-8 rounded-full"
			/>
		</div>
		{#await requirements then requirements}
			{#each requirements ?? [] as requirement}
				<div
					style="background: {generateRequirementColor(requirement)}"
					class="rounded-md pb-0.5 pl-2 pr-2 pt-0.5 leading-none"
				>
					<span class="text-base leading-none text-content-primary">
						{formatRequirementName(requirement)}
					</span>
				</div>
			{/each}
		{/await}
	</div>

	<p class="text-content-secondary" dir="rtl">
		{course.about}
	</p>

	<div class="space-x-1">
		<Button variant="primary" onClick={() => {}}>Plan</Button>
		<Button
			variant="secondary"
			onClick={() => ($wishlist = [...new Set([...$wishlist, course.code])])}
		>
			Wish list
		</Button>
	</div>

	<div>
		<p class="text-content-primary">
			{course.points ?? 'N/A'} points
		</p>
		<p class="text-content-primary">
			{course.median ?? 'N/A'} median
		</p>
	</div>
{/await}
