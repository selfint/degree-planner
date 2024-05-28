<script lang="ts">
	import CourseElement from './CourseElement.svelte';
	import CourseErrorElement, { type CourseError } from './CourseErrorElement.svelte';

	export let name: 'Winter' | 'Spring' | 'Summer';
	export let courses: Course[];
	export let onCourseClick: (code: string) => void;
	export let previousCourses: string[];

	$: courseStatus = courses.map((course): CourseError => {
		const error: CourseError = {
			generic: undefined,
			dependencies: [],
			adjacencies: [],
			exclusives: []
		};

		if (course.info === undefined) {
			error.generic = 'Missing information';
			return error;
		}

		if (course.info.connections === undefined) {
			error.generic = 'Missing course dependencies';
			return error;
		}

		const connections = course.info.connections;

		error.dependencies = connections.dependencies.map((deps) =>
			deps.filter((dep) => !previousCourses.includes(dep))
		);

		error.adjacencies = connections.adjacent.some(
			(adj) => previousCourses.includes(adj) || courses.some((c) => c.code === adj)
		)
			? []
			: connections.adjacent;

		error.exclusives = connections.exclusive.filter(
			(exc) => previousCourses.includes(exc) || courses.some((c) => c.code === exc)
		);

		return error;
	});

	function courseOk(courseError: CourseError): boolean {
		return (
			courseError.generic === undefined &&
			(courseError.dependencies.length === 0 ||
				courseError.dependencies.some((d) => d.length === 0)) &&
			courseError.adjacencies.length === 0 &&
			courseError.exclusives.length === 0
		);
	}
</script>

<h2 class="border-b-2 border-dark-400 pl-2 text-lg text-white">{name}</h2>
{#each courses as course, i}
	<CourseElement
		{course}
		index={i}
		onClick={(c) => onCourseClick(c.code)}
		bg={courseOk(courseStatus[i]) ? undefined : 'bg-red-900'}
	/>
{/each}
{#if courseStatus.some((s) => !courseOk(s))}
	<h3 class="p-2 text-lg text-white">Errors</h3>
	<ul class="p-2">
		{#each courses as course, i}
			{#if !courseOk(courseStatus[i])}
				<CourseErrorElement {course} courseError={courseStatus[i]} />
			{/if}
		{/each}
	</ul>
{/if}
