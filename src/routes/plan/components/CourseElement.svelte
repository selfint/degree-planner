<script lang="ts">
	import { selectedGroup } from '../stores';

	export let course: Course;
	export let onClick: (course: Course) => void;
	export let index = 0;
	export let bg: string | undefined = undefined;

	function getCourseBg(code: string, index: number, group: Group | undefined): string {
		if (bg !== undefined) {
			return bg;
		}

		if (group?.courses.some((course) => course.code === code)) {
			return 'bg-indigo-900';
		}

		return index % 2 === 0 ? 'bg-dark-500' : 'bg-dark-700';
	}
</script>

<div
	on:mousedown|preventDefault|stopPropagation={() => onClick(course)}
	role="button"
	tabindex={index}
	class="{getCourseBg(course.code, index, $selectedGroup)} border-b-2 border-dark-400 p-1"
>
	<p class="text-sm text-white">{course.info?.name}</p>
</div>
