<script lang="ts">
	import CourseElement from './CourseElement.svelte';

	export let name: 'Winter' | 'Spring' | 'Summer';
	export let courses: Course[];
	export let onCourseClick: (code: string) => void;
</script>

<h2 class="border-b-2 border-dark-400 pl-2 text-lg text-white">{name}</h2>
{#each courses as course, i}
	<CourseElement {course} index={i} onClick={(c) => onCourseClick(c.code)} />
{/each}
