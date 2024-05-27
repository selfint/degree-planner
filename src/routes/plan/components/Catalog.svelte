<script lang="ts">
	import { selectedGroup } from '../stores';

	export let courses: Course[];
	export let onClick: (course: Course) => void;

	function getCourseBg(code: string, index: number, group: Group | undefined) {
		if (group?.courses.some((course) => course.code === code)) {
			return 'bg-indigo-900';
		}

		return index % 2 === 0 ? 'bg-dark-500' : 'bg-dark-700';
	}
</script>

<h2 class="text-xl text-white">Catalog</h2>
{#each courses as course, i}
	{#if course.info !== undefined}
		<div
			class="{getCourseBg(course.code, i, $selectedGroup)} p-1 text-sm"
			role="button"
			tabindex={i}
			on:mousedown={() => onClick(course)}
		>
			<p class="text-white">{course.info?.name}</p>
		</div>
	{/if}
{/each}
