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

<div
	class="mb-2.5 mr-2.5 h-full w-80 rounded-md border-2 border-black bg-white p-2.5 shadow hover:shadow-lg"
>
	<div class="flex flex-grow">
		<h2 class="flex-grow text-3xl font-bold">
			{$group.name}
		</h2>
		<button
			class="bg-blue border-2 border-black bg-teal-200 p-1 font-bold hover:shadow"
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
				class="m-1 border-2 border-black p-2.5 focus:bg-teal-100 focus:shadow focus:outline-none active:shadow"
				bind:value={points}
				on:input|preventDefault={(e) => {
					// @ts-ignore
					points = stringToNum(e.target?.value ?? undefined);
				}}
			/>
		</div>
		<form on:submit|preventDefault={handleSubmit}>
			<textarea
				class="m-1 border-2 border-black p-2.5 focus:bg-teal-100 focus:shadow focus:outline-none active:shadow"
				placeholder="Copy paste group text..."
				bind:value={textBlob}
			/>
			<button class="h-12 border-2 border-black bg-teal-200 p-2.5 hover:shadow" type="submit"
				>Upload</button
			>
		</form>
	</div>

	<div class="m-1 border-2 border-black bg-teal-100">
		{#if courses.length > 0}
			{#if progress === -1 || progress === courses.length}
				<p class="bg-yellow-300 p-2.5 text-lg font-bold">Loaded {courses.length}</p>
			{:else}
				<div
					class="h-full bg-teal-200 p-2.5 font-bold"
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
