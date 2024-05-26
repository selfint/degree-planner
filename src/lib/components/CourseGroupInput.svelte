<script lang="ts">
	import type { Writable } from 'svelte/store';

	import { parseCatalog } from '$lib/catalogParser';
	import { getCourseInfo } from '$lib/api';

	export let group: Writable<Group>;
	export let onDelete: () => void;

	let textBlob: string | undefined = undefined;
	let points: string | undefined = $group.points.toString();

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

	let progress = -1;
	$: courses = $group.courses;

	async function handleSubmit(): Promise<void> {
		if (textBlob === undefined || points === undefined) {
			return;
		}

		courses = parseCatalog(textBlob).map((course) => {
			return {
				code: course,
				info: undefined
			};
		});

		progress = 0;

		await Promise.all(
			courses.map(async (course) => {
				course.info = await getCourseInfo(course.code);

				progress++;
				courses = sortCourses(courses);
			})
		);

		group.update((group) => {
			group.courses = courses;
			return group;
		});
	}
</script>

<div
	class="m-2 h-full w-80 rounded-md border-2 border-black bg-white p-1 hover:shadow-[8px_8px_0px_rgba(0,0,0,1)]"
>
	<div class="flex flex-grow">
		<h2 class="flex-grow text-3xl font-bold">
			{$group.name}
		</h2>
		<button
			class="bg-blue h-12 border-2 border-black bg-red-600 p-2.5 hover:bg-red-500 hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:bg-[#00E1EF]"
			on:mousedown|preventDefault={onDelete}>X</button
		>
	</div>
	<div>
		<div class="m-1">
			<label for="group-name">Points:</label>
			<input
				type="text"
				id="group-name"
				placeholder="points"
				bind:value={points}
				class="m-1 border-2 border-black p-2.5 focus:bg-[#a6d0ff] focus:shadow-[2px_2px_0px_rgba(0,0,0,1)] focus:outline-none active:shadow-[2px_2px_0px_rgba(0,0,0,1)]"
			/>
		</div>
		<form on:submit|preventDefault={handleSubmit}>
			<textarea
				class="m-1 border-2 border-black p-2.5 focus:bg-[#a6d0ff] focus:shadow-[2px_2px_0px_rgba(0,0,0,1)] focus:outline-none active:shadow-[2px_2px_0px_rgba(0,0,0,1)]"
				placeholder="Copy paste group text..."
				bind:value={textBlob}
			/>
			<button
				class="h-12 border-2 border-black bg-[#A6FAFF] p-2.5 hover:bg-[#79F7FF] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:bg-[#00E1EF]"
				type="submit">Upload</button
			>
		</form>
	</div>

	<div class="m-1 border-2 border-black bg-gray-200 dark:bg-gray-700">
		{#if courses.length > 0}
			{#if progress === -1 || progress === courses.length}
				<p class="bg-green-600 p-2.5 text-lg font-bold">Loaded {courses.length}</p>
			{:else}
				<div
					class="h-full bg-green-500 p-2.5"
					style="width: {Math.floor((progress / courses.length) * 100)}%"
				>
					<p class="overflow-x-visible whitespace-nowrap text-lg">
						Loading {progress} / {courses.length}
					</p>
				</div>
			{/if}
		{/if}
	</div>
</div>
