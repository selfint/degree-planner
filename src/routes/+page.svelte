<script lang="ts">
	import { parseCatalog } from '$lib/catalogParser';
	import { getMedian } from '$lib/courseMedian';
	import { getName } from '$lib/courseName';
	import { courses } from '$lib/stores';

	let textBlob: string | undefined = undefined;

	async function handleSubmit(event: Event): Promise<void> {
		if (textBlob !== undefined) {
			$courses = parseCatalog(textBlob).map((course) => {
				return {
					code: course,
					median: undefined,
					name: undefined
				};
			});

			await Promise.all(
				$courses.map(async (c) => {
					const [median, name] = await Promise.all([
						await getMedian(c.code),
						await getName(c.code)
					]);
					c.median = median;
					c.name = name;
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
	<table>
		<thead>
			<tr>
				<th> Code </th>
				<th> Median </th>
				<th> Name </th>
			</tr>
		</thead>
		<tbody>
			{#each $courses as course}
				<tr>
					<td>{course.code}</td>
					<td>
						{#if course.median === undefined}
							N / A
						{:else}
							<span class="median">
								{course.median.toFixed(2)}
							</span>
						{/if}
					</td>
					<td>
						{#if course.name === undefined}
							N / A
						{:else}
							{course.name}
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
