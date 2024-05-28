<script lang="ts">
	import CourseGroupInput from './components/CourseGroupInput.svelte';
	import { groups, totalPoints } from '$lib/stores';
	import { writable, get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { stringToNum } from '$lib/stringToNum';
	import Logo from '$lib/assets/logo.png';

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

<div class="flex flex-row items-center space-x-2 border-b-2 border-dark-400 p-1">
	<img src={Logo} alt="Logo" class="h-12" />
	<h1 class="text-4xl text-white">Degree catalog</h1>
	<div class="flex-grow"></div>
	<button
		on:mousedown={() => goto('/plan')}
		class="h-12 rounded-md border-2 border-dark-400 bg-teal-800 p-2 text-white"
	>
		Plan
	</button>
</div>

<div class="ml-2 mr-2 mt-2 h-full rounded-md border-2 border-dark-400 bg-dark-700 p-2">
	<label for="total-points" class="text-2xl text-white">Total points:</label>
	<input
		type="text"
		id="total-points"
		bind:value={$totalPoints}
		class="rounded-md border-2 border-dark-400 bg-dark-50 pl-1 text-white focus:bg-teal-700 focus:outline-none"
		on:input|preventDefault={(e) => {
			// @ts-ignore
			$totalPoints = stringToNum(e.target?.value ?? undefined);
		}}
	/>
</div>
<div class="flex flex-row flex-wrap p-2">
	{#each $groups as group, i}
		<CourseGroupInput
			{group}
			onDelete={() => ($groups = $groups.filter((_, index) => index !== i))}
		/>
	{/each}
	<div class="h-full w-80 rounded-md border-2 border-dark-400 bg-dark-700 bg-opacity-50 p-2">
		<h2 class="text-3xl text-white">New group</h2>
		<form on:submit|preventDefault={newGroup}>
			<div>
				<label for="group-name" class="text-white">Name:</label>
				<input
					type="text"
					id="group-name"
					bind:value={newName}
					class="m-1 rounded-md border-2 border-dark-400 bg-dark-50 pl-1 text-white focus:bg-teal-700 focus:outline-none"
				/>
			</div>
			<div>
				<label for="group-points" class="text-white">Points:</label>
				<input
					type="text"
					id="group-points"
					class="m-1 rounded-md border-2 border-dark-400 bg-dark-50 pl-1 text-white focus:bg-teal-700 focus:outline-none"
					bind:value={newPoints}
					on:input|preventDefault={(e) => {
						// @ts-ignore
						newPoints = stringToNum(e.target?.value ?? undefined);
					}}
				/>
			</div>
			<button
				class="bg-teal h-12 w-full border-2 border-dark-400 bg-teal-800 p-2 text-white"
				type="submit">Add!</button
			>
		</form>
	</div>
</div>
