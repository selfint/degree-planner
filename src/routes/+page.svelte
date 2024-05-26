<script lang="ts">
	import CourseGroupInput from '$lib/components/CourseGroupInput.svelte';
	import { courses, groups, totalPoints, loadStores, storeHook } from '$lib/stores';
	import { writable, get } from 'svelte/store';
	import { onMount } from 'svelte';

	onMount(() => {
		loadStores();
		storeHook();
	});

	function sortCourses(array: Course[]) {
		return array.slice().sort((a, b) => {
			if (a.info?.median === b.info?.median) {
				return a.code.localeCompare(b.code);
			}

			if (a.info?.median === undefined) return 1;
			if (b.info?.median === undefined) return -1;

			return b.info?.median - a.info?.median;
		});
	}

	let newName: string | undefined = undefined;
	let newPoints: string | undefined = undefined;

	function newGroup(): void {
		if (newName === undefined || newPoints === undefined) {
			return;
		}

		if ($groups.some((group) => get(group).name === newName)) {
			return;
		}

		$groups = [...$groups, writable({ name: newName, courses: [], points: parseInt(newPoints) })];
	}

	for (const group of $groups) {
		group.subscribe(() => {
			$courses = sortCourses($groups.flatMap((group) => get(group).courses));
		});
	}

	groups.subscribe(
		(value) => ($courses = sortCourses(value.flatMap((group) => get(group).courses)))
	);

	console.dir($groups.map(get));
</script>

<h1 class="border-b-2 border-black text-center text-3xl">Degree catalog</h1>

<div
	class="m-1 h-full rounded-md border-2 border-black bg-white p-1 hover:shadow-[8px_8px_0px_rgba(0,0,0,1)]"
>
	<label for="total-points" class="text-2xl font-bold">Total points:</label>
	<input
		type="text"
		id="total-points"
		bind:value={$totalPoints}
		class="m-1 border-2 border-black p-1"
	/>
</div>
<div class="flex flex-row flex-wrap">
	{#each $groups as group, i}
		<CourseGroupInput
			{group}
			onDelete={() => ($groups = $groups.filter((_, index) => index !== i))}
		/>
	{/each}
	<div
		class="m-2 h-full w-80 rounded-md border-2 border-black bg-white p-2.5 hover:shadow-[8px_8px_0px_rgba(0,0,0,1)]"
	>
		<h2 class="text-xl font-bold">New group</h2>
		<form on:submit|preventDefault={newGroup}>
			<div>
				<label for="group-name">Name:</label>
				<input
					type="text"
					id="group-name"
					bind:value={newName}
					class="m-1 border-2 border-black p-2.5 focus:bg-[#a6d0ff] focus:shadow-[2px_2px_0px_rgba(0,0,0,1)] focus:outline-none active:shadow-[2px_2px_0px_rgba(0,0,0,1)]"
				/>
			</div>
			<div>
				<label for="group-points">Points:</label>
				<input
					type="text"
					id="group-points"
					class="m-1 border-2 border-black p-2.5 focus:bg-[#a6d0ff] focus:shadow-[2px_2px_0px_rgba(0,0,0,1)] focus:outline-none active:shadow-[2px_2px_0px_rgba(0,0,0,1)]"
					bind:value={newPoints}
					on:input={(e) => {
						// @ts-ignore
						e.target.value = e.target.value.replace(/\D/g, '');
					}}
				/>
			</div>
			<button
				class="h-12 border-2 border-black bg-[#A6FAFF] p-2.5 hover:bg-[#79F7FF] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:bg-[#00E1EF]"
				type="submit">Submit</button
			>
		</form>
	</div>
</div>
