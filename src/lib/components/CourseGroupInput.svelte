<script lang="ts">
	import type { Writable } from 'svelte/store';

	import { stringToNum } from '$lib/stringToNum';

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

<div class="mb-2 mr-2 h-full w-80 rounded-md border-2 border-dark-400 bg-dark-700 p-2">
	<div class="flex flex-grow">
		<h2 class="flex-grow text-xl text-white">
			{$group.name}
		</h2>
		<button
			class="border-2 border-dark-400 bg-teal-800 p-1 text-white"
			on:mousedown|preventDefault={onDelete}>X</button
		>
	</div>
	<div>
		<div class="mb-1 mt-1">
			<label for="group-name" class="text-white">Points:</label>
			<input
				type="text"
				id="group-name"
				placeholder="points"
				class="rounded-md border-2 border-dark-400 bg-dark-50 pl-1 text-white focus:bg-teal-700 focus:outline-none"
				bind:value={points}
				on:input|preventDefault={(e) => {
					// @ts-ignore
					points = stringToNum(e.target?.value ?? undefined);
				}}
			/>
		</div>
		<form on:submit|preventDefault={handleSubmit}>
			<textarea
				class="w-full resize-none border-2 border-dark-400 bg-dark-50 p-2 text-white focus:bg-teal-700 focus:outline-none"
				placeholder="Copy paste group text..."
				bind:value={textBlob}
			/>
			<button class="h-12 w-full border-2 border-dark-400 bg-teal-800 p-2 text-white" type="submit"
				>Upload</button
			>
		</form>
	</div>

	<div class="mt-1.5 border-2 border-dark-400 bg-teal-800">
		{#if courses.length > 0}
			{#if progress === -1 || progress === courses.length}
				<p class="p-2 text-lg text-white">Loaded {courses.length}</p>
			{:else}
				<div
					class="h-full bg-teal-900 p-2 text-white"
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
