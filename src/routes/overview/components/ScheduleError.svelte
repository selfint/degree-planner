<script lang="ts">
	import { getCourseData } from '$lib/courseData';

	export let course: Course;
	export let index: number;
	export let semesters: string[][];

	const semester = semesters[index];
	const previous = semesters.slice(0, index);

	let dep: Promise<Course[][]> = (async () => [])();
	let adj: Promise<Course[]> = (async () => [])();

	function dependencyTaken(code: string): boolean {
		return previous.flat().includes(code);
	}

	function adjacencyTaken(code: string): boolean {
		return dependencyTaken(code) || semester.includes(code);
	}

	if (course.connections !== undefined) {
		const dependencies = course.connections.dependencies ?? [];
		const adjacencies = course.connections.adjacent ?? [];

		const dependenciesSatisfied =
			dependencies.length === 0 ||
			dependencies.some((group) => group.every(dependencyTaken));

		const adjacenciesSatisfied =
			adjacencies.length === 0 || adjacencies.some(adjacencyTaken);

		if (!dependenciesSatisfied) {
			dep = Promise.all(
				dependencies.map(
					async (group) => await Promise.all(group.map(getCourseData))
				)
			).then((dep) =>
				dep
					.map((g) => g.filter((c) => (c.name ?? '').includes('-')))
					.filter((g) => g.length > 0)
			);
		}

		if (!adjacenciesSatisfied) {
			adj = Promise.all(adjacencies.map(getCourseData)).then((adj) =>
				adj.filter((c) => (c.name ?? '').includes('-'))
			);
		}
	}
</script>

{#await dep}
	<p class="p-2 pb-1 pt-1 text-content-secondary">Loading...</p>
{:then dep}
	{#if dep.length > 0}
		<div class="p-2 pb-1 pt-1">
			<h2 class="text-base text-content-primary">Dependencies</h2>
			<div class="mb-2 space-y-2">
				{#each dep as group, i}
					{#if i !== 0}
						<p class="w-full text-center text-content-secondary">OR</p>
					{/if}
					<div class="space-y-1">
						{#each group as course}
							<slot name="dep" {course} taken={dependencyTaken(course.code)} />
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/await}

{#await adj}
	<p class="p-2 pb-1 pt-1 text-content-secondary">Loading...</p>
{:then adj}
	{#if adj.length > 0}
		<div class="p-2 pb-1 pt-1">
			<h2 class="text-base text-content-primary">Adjacencies</h2>
			<div class="space-y-1">
				{#each adj as course}
					<slot name="adj" {course} taken={adjacencyTaken(course.code)} />
				{/each}
			</div>
		</div>
	{/if}
{/await}
