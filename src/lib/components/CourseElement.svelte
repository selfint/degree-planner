<script lang="ts">
	import { generateRequirementColor, generateCourseColor } from '$lib/colors';

	export let course: Course;
	export let requirements: Promise<string[]> | undefined;

	const color = generateCourseColor(course);

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	const median =
		course.median === undefined ? 'N/A' : Math.round(course.median * 10) / 10;

	const hasTest = course.tests === undefined || course.tests.length > 0;
</script>

<div
	class="flex h-fit w-[220px] flex-col justify-between space-y-3 rounded-md bg-card-primary p-2 leading-none"
>
	<div class="flex h-full flex-row items-start justify-between">
		<div class="min-h-8">
			<span class="m-0 p-0 text-xs leading-none text-content-primary" dir="rtl">
				{course.name?.split(' - ')[1] ?? course.code}
			</span>
			{#if course.name !== undefined}
				<span class="text-xs leading-none text-content-secondary">
					{course.code}
				</span>
			{/if}
		</div>
		<div class="m-0 ml-1 p-0">
			<div
				style="background: {color}"
				class="h-4 w-4 {hasTest ? 'rounded-full' : ''}"
			/>
		</div>
	</div>

	<div class="flex flex-row items-baseline">
		<div class="flex flex-row items-baseline space-x-1">
			{#await requirements then requirements}
				{#each requirements ?? [] as requirement}
					<div
						style="background: {generateRequirementColor(requirement)}"
						class="rounded-md pb-0.5 pl-2 pr-2 leading-none"
					>
						<span class="text-xs leading-none text-content-primary">
							{formatName(requirement)}
						</span>
					</div>
				{/each}
			{/await}
		</div>
		<div class="flex-grow" />
		<div class="text-xs text-content-secondary">
			<span class="mr-2">{median}</span>
			<span>{course.points ?? 'N/A'}</span>
		</div>
	</div>
</div>
