<script lang="ts">
	import { goto } from '$app/navigation';

	import { courses, years } from '$lib/stores';
	import { get, writable } from 'svelte/store';

	let newYearName: string | undefined = undefined;

	function deleteYear(i: number): void {
		$years = $years.filter((_, index) => index !== i);
	}

	function newYear() {
		if (newYearName === undefined) {
			return;
		}

		if ($years.some((year) => get(year).name === newYearName)) {
			return;
		}

		$years = [...$years, writable({ name: newYearName, winter: [], summer: [], spring: [] })];
		newYearName = undefined;
	}
</script>

<div class="flex flex-row items-center space-x-2 border-b-2 border-black bg-yellow-200 p-1">
	<h1 class="text-4xl font-bold">Degree catalog</h1>
	<div class="flex-grow"></div>
	<button
		on:mousedown={() => goto('/')}
		class="h-12 border-2 border-black bg-teal-200 p-2.5 font-bold hover:shadow">Settings</button
	>
</div>

<div class="flex flex-row flex-wrap">
	<div class="p-2.5">
		<h2 class="text-2xl font-bold">Requirements</h2>
	</div>
	<div class="flex-grow p-2.5">
		<h2 class="text-2xl font-bold">Years</h2>

		{#each $years as year, i}
			<div
				class="mt-2.5 w-full rounded-md border-2 border-black bg-white p-2.5 shadow hover:shadow-lg"
			>
				<div class="flex flex-row">
					<h3 class="text-xl font-bold">{get(year).name}</h3>
					<div class="flex-grow" />
					<button
						on:mousedown={() => deleteYear(i)}
						class="bg-blue border-2 border-black bg-teal-200 p-1 font-bold hover:shadow"
					>
						X
					</button>
				</div>
				<div class="flex flex-row items-start">
					<div class="flex-1">
						<h2 class="text-lg font-bold">Winter</h2>
					</div>
					<div class="flex-1">
						<h2 class="text-lg font-bold">Summer</h2>
					</div>
					<div class="flex-1">
						<h2 class="text-lg font-bold">Spring</h2>
					</div>
				</div>
			</div>
		{/each}

		<div
			class="mt-2.5 w-full rounded-md border-2 border-black bg-white p-2.5 shadow hover:shadow-lg"
		>
			<form on:submit|preventDefault={newYear}>
				<div>
					<label for="group-name">Name:</label>
					<input
						type="text"
						id="group-name"
						bind:value={newYearName}
						class="m-1 border-2 border-black p-2.5 focus:bg-teal-100 focus:shadow focus:outline-none active:shadow"
					/>
				</div>
				<button
					class="bg-teal h-12 w-full border-2 border-black bg-teal-200 p-2.5 font-bold hover:shadow"
					type="submit">Add!</button
				>
			</form>
		</div>
	</div>
	<div class="p-2.5">
		<h2 class="text-2xl font-bold">Wishlist</h2>
		{#each $courses as course}
			{#if course.info !== undefined}
				<p>{course.info?.name}</p>
			{/if}
		{/each}
	</div>
	<div class="p-2.5">
		<h2 class="text-2xl font-bold">Catalog</h2>
		{#each $courses as course}
			{#if course.info !== undefined}
				<p>{course.info?.name}</p>
			{/if}
		{/each}
	</div>
</div>
