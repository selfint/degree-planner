<script lang="ts">
	import { selectedGroup } from '../stores';

	export let name: 'Winter' | 'Spring' | 'Summer';
	export let courses: Course[];
	export let onCourseClick: (code: string) => void;

	function getCourseBg(code: string, index: number, group: Group | undefined) {
		if (group?.courses.some((course) => course.code === code)) {
			return 'bg-indigo-900';
		}

		return index % 2 === 0 ? 'bg-dark-500' : 'bg-dark-700';
	}
</script>

<h2 class="border-b-2 border-dark-400 pl-2 text-lg text-white">{name}</h2>
{#each courses as course, i}
	<div
		on:mousedown|preventDefault|stopPropagation={() => onCourseClick(course.code)}
		role="button"
		tabindex={i}
		class="{getCourseBg(course.code, i, $selectedGroup)} p-1"
	>
		<p class="text-sm text-white">{course.info?.name}</p>
	</div>
{/each}
