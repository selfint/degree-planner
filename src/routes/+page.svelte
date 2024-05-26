<script lang="ts">
	import CourseGroupInput from '$lib/components/CourseGroupInput.svelte';
	import { courses, groups, totalPoints, loadStores, storeHook } from '$lib/stores';
	import { writable, get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { stringToNum } from '$lib/stringToNum';

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
		newName = undefined;
		newPoints = undefined;
	}
</script>

<div class="flex flex-row items-center space-x-2 border-b-2 border-black bg-yellow-200 p-1">
	<h1 class="text-4xl font-bold">Degree catalog</h1>
	<div class="flex-grow"></div>
	<button
		on:mousedown={() => goto('/plan')}
		class="h-12 border-2 border-black bg-teal-200 p-2.5 font-bold hover:shadow">Plan!</button
	>
</div>

<div
	class="ml-2.5 mr-2.5 mt-2.5 h-full rounded-md border-2 border-black bg-white p-2.5 shadow hover:shadow-lg hover:shadow-black/100"
>
	<label for="total-points" class="text-2xl font-bold">Total points:</label>
	<input
		type="text"
		id="total-points"
		bind:value={$totalPoints}
		class="m-1 border-2 border-black p-2.5 focus:bg-teal-100 focus:shadow focus:outline-none active:shadow"
		on:input|preventDefault={(e) => {
			// @ts-ignore
			$totalPoints = stringToNum(e.target?.value ?? undefined);
		}}
	/>
</div>
<div class="flex flex-row flex-wrap p-2.5">
	{#each $groups as group, i}
		<CourseGroupInput
			{group}
			onDelete={() => ($groups = $groups.filter((_, index) => index !== i))}
		/>
	{/each}
	<div class="h-full w-80 rounded-md border-2 border-black bg-white p-2.5 shadow hover:shadow-lg">
		<h2 class="text-3xl font-bold">New group</h2>
		<form on:submit|preventDefault={newGroup}>
			<div>
				<label for="group-name">Name:</label>
				<input
					type="text"
					id="group-name"
					bind:value={newName}
					class="m-1 border-2 border-black p-2.5 focus:bg-teal-100 focus:shadow focus:outline-none active:shadow"
				/>
			</div>
			<div>
				<label for="group-points">Points:</label>
				<input
					type="text"
					id="group-points"
					class="m-1 border-2 border-black p-2.5 focus:bg-teal-100 focus:shadow focus:outline-none active:shadow"
					bind:value={newPoints}
					on:input|preventDefault={(e) => {
						// @ts-ignore
						newPoints = stringToNum(e.target?.value ?? undefined);
					}}
				/>
			</div>
			<button
				class="bg-teal h-12 w-full border-2 border-black bg-teal-200 p-2.5 font-bold hover:shadow"
				type="submit">Add!</button
			>
		</form>
	</div>
</div>
