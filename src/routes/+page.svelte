<script lang="ts">
	import { parseCatalog } from '$lib/catalogParser';

	let courses: string[] = [];

	let textBlob: string | undefined = undefined;

	async function handleSubmit(event: Event): Promise<void> {
		if (textBlob !== undefined) {
			courses = parseCatalog(textBlob);
		}
	}
</script>

<h1>Technion Course Plot</h1>

{#if courses.length === 0}
	<h2>Enter catalog text</h2>
	<form on:submit|preventDefault={handleSubmit}>
		<textarea bind:value={textBlob} rows="10" cols="50"></textarea>
		<button type="submit">Submit</button>
	</form>
{:else}
	<h2>Courses</h2>
	{#each courses as course}
		<ul>{course}</ul>
	{/each}
{/if}
