<script lang="ts">
	import CourseElement from './CourseElement.svelte';

	export let courses: Course[];
	export let onClick: (course: Course) => void;
</script>

<h2 class="text-xl text-white">Catalog</h2>
{#each courses as course, i}
	<CourseElement {course} index={i} {onClick} />
{/each}
