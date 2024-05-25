<script lang="ts">
	import { parseCatalog } from '$lib/catalogParser';
	import { getCourseInfo } from '$lib/api';
	import { courses } from '$lib/stores';
	import CourseList from '$lib/components/CourseList.svelte';
	import DAG from '$lib/components/DAG.svelte';

	let textBlob: string | undefined = undefined;

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

	async function handleSubmit(event: Event): Promise<void> {
		if (textBlob !== undefined) {
			$courses = parseCatalog(textBlob).map((course) => {
				return {
					code: course,
					info: undefined
				};
			});

			await Promise.all(
				$courses.map(async (c) => {
					c.info = await getCourseInfo(c.code);

					$courses = sortCourses($courses);
				})
			);
		}
	}
</script>

<h1>Technion Course Plot</h1>

{#if $courses.length === 0}
	<h2>Enter catalog text</h2>
	<form on:submit|preventDefault={handleSubmit}>
		<textarea bind:value={textBlob} rows="10" cols="50"></textarea>
		<button type="submit">Submit</button>
	</form>
{:else}
	<h2>Semesters</h2>
	<DAG />

	<h2>Courses</h2>
	<CourseList />
{/if}
