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

	console.dir($groups.map(get));
</script>

<h1 class="border-b-2 border-black text-center text-3xl">Degree catalog</h1>

<div class="p-1">
	<label for="total-points">Total points:</label>
	<input type="text" id="total-points" bind:value={$totalPoints} class="border border-black p-1" />
</div>
<div class="flex flex-row flex-wrap">
	{#each $groups as group}
		<CourseGroupInput {group} onDelete={() => {}} />
	{/each}
	<div class="m-1 rounded border border-black p-1">
		<h2 class="text-xl font-bold">New group</h2>
		<form on:submit|preventDefault={newGroup}>
			<div>
				<label for="group-name">Group name:</label>
				<input type="text" id="group-name" bind:value={newName} class="border border-black" />
			</div>
			<div>
				<label for="group-points">Group points:</label>
				<input
					type="text"
					id="group-points"
					class="border border-black"
					bind:value={newPoints}
					on:input={(e) => {
						// @ts-ignore
						e.target.value = e.target.value.replace(/\D/g, '');
					}}
				/>
			</div>
			<button class="border border-black p-1" type="submit">Submit</button>
		</form>
	</div>
</div>
