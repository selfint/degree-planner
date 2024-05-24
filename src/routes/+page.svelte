<script lang="ts">
	import { parseCatalog } from '$lib/catalogParser';
	import { getMedian } from '$lib/courseMedian';
	import { courses } from '$lib/stores';

	let textBlob: string | undefined = undefined;

	async function handleSubmit(event: Event): Promise<void> {
		if (textBlob !== undefined) {
			$courses = parseCatalog(textBlob).map((course) => {
				return {
					code: course,
					median: undefined
				};
			});

			await Promise.all(
				$courses.map(async (c) => {
					c.median = await getMedian(c.code);

					$courses = $courses;
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
	<h2>Courses</h2>
	{#each $courses as course}
		<ul>
			{course.code} -
			{#if course.median === undefined}
				N / A
			{:else}
				<span class="median">
					{course.median.toFixed(2)}
				</span>
			{/if}
		</ul>
	{/each}
{/if}
