<script lang="ts">
	import { getCourseData } from '$lib/courseData';

	export let course: Course;
	export let index: number;
	export let semesters: string[][];

	const semester = semesters[index];
	const previous = semesters.slice(0, index).flat();

	function dependencyTaken(course: Course): boolean {
		return (
			previous.includes(course.code) ||
			(course.connections?.exclusive ?? []).some((c) => previous.includes(c))
		);
	}

	function adjacencyTaken(course: Course): boolean {
		return (
			dependencyTaken(course) ||
			semester.includes(course.code) ||
			(course.connections?.exclusive ?? []).some((c) => semester.includes(c))
		);
	}

	const dependencies = Promise.all(
		(course.connections?.dependencies ?? []).map(
			async (group) => await Promise.all(group.map(getCourseData))
		)
	).then((dep) =>
		dep
			.map((g) => g.filter((c) => (c.name ?? '').includes('-')))
			.filter((g) => g.length > 0)
	);
	const adjacencies = Promise.all(
		(course.connections?.adjacent ?? []).map(getCourseData)
	).then((adj) => adj.filter((c) => (c.name ?? '').includes('-')));

	const dependenciesSatisfied = (dependencies: Course[][]) =>
		dependencies.length === 0 ||
		dependencies.some((group) => group.every(dependencyTaken));

	const adjacenciesSatisfied = (adjacencies: Course[]) =>
		adjacencies.length === 0 || adjacencies.some(adjacencyTaken);
</script>

{#await dependencies}
	<p class="p-2 pb-1 pt-1 text-content-secondary">Loading...</p>
{:then dependencies}
	{#if !dependenciesSatisfied(dependencies)}
		<div class="p-2 pb-1 pt-1">
			<h2 class="text-base text-content-primary">Dependencies</h2>
			<div class="mb-2 space-y-2">
				{#each dependencies as group, i}
					{#if i !== 0}
						<p class="w-full text-center text-content-secondary">OR</p>
					{/if}
					<div class="space-y-1">
						{#each group as course}
							<slot name="dep" {course} taken={dependencyTaken(course)} />
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/await}

{#await adjacencies}
	<p class="p-2 pb-1 pt-1 text-content-secondary">Loading...</p>
{:then adjacencies}
	{#if !adjacenciesSatisfied(adjacencies)}
		<div class="p-2 pb-1 pt-1">
			<h2 class="text-base text-content-primary">Adjacencies</h2>
			<div class="space-y-1">
				{#each adjacencies as course}
					<slot name="adj" {course} taken={adjacencyTaken(course)} />
				{/each}
			</div>
		</div>
	{/if}
{/await}
