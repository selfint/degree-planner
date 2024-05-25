<script lang="ts">
	import type { Writable } from 'svelte/store';

	import { parseCatalog } from '$lib/catalogParser';
	import { getCourseInfo } from '$lib/api';

	export let group: Writable<Group>;
	export let onDelete: () => void;

	let textBlob: string | undefined = undefined;
	let points: string | undefined = undefined;

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

<div class="m-1 rounded border border-black p-1">
	<form class="m-1" on:submit|preventDefault={handleSubmit}>
		<h2 class="text-xl font-bold">{$group.name}</h2>
		<div>
			<label for="group-name">Points:</label>
			<input
				type="text"
				id="group-name"
				placeholder="points"
				bind:value={points}
				class="border border-black"
			/>
		</div>
		<textarea
			class="mt-1 h-full border border-black p-1"
			placeholder="Copy paste group text..."
			bind:value={textBlob}
		></textarea>
		<button class="border border-black p-1" type="submit">Submit</button>
	</form>

	<div>
		{#if courses.length > 0}
			{#if progress === -1 || progress < courses.length}
				<p class="text-lg">Loaded {courses.length}</p>
			{:else}
				<p class="text-lg">Loading ({progress} / {courses.length})</p>
				<progress max={courses.length} value={progress} />
			{/if}
		{/if}
	</div>
</div>
