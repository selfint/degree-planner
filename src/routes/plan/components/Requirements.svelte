<script lang="ts">
	import { selectedGroup } from '../stores';

	export let groups: Group[];
	export let years: Year[];

	$: groupPoints = groups.map((group) =>
		group.courses
			.filter((course) =>
				years.some(
					(y) =>
						y.winter.includes(course.code) ||
						y.spring.includes(course.code) ||
						y.summer.includes(course.code)
				)
			)
			.map((course) => course.info?.points ?? 0)
			.reduce((a, b) => a + b, 0)
	);

	const getGroupBg = (group: Group, selected: Group | undefined) =>
		group.name === selected?.name ? 'bg-indigo-900' : 'bg-dark-700';
</script>

<h2 class="text-xl text-white">Requirements</h2>
{#each groups as group, i}
	<div
		class="mb-2 flex flex-row items-center border-2 border-dark-400 {getGroupBg(
			group,
			$selectedGroup
		)}  p-2"
		role="button"
		tabindex={i}
		on:mousedown|preventDefault={() =>
			($selectedGroup = group.name === $selectedGroup?.name ? undefined : group)}
	>
		<h3 class="text-xl text-white">{group.name}</h3>
		<div class="min-w-2 flex-grow" />
		<p class="text-white">
			{groupPoints[i]} / {group.points}
		</p>
	</div>
{/each}
