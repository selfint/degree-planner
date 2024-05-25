<script lang="ts">
	export let courses: Course[];
	export let onClick: (course: Course) => void = () => {};
	export let enableSearch = false;

	let search = '';

	const filterCourses = (courses: Course[]) => {
		courses = courses.filter((course) => course.info?.name !== undefined);

		if (search.trim() === '') return courses;

		return courses.filter((course) => {
			return course.code.toLowerCase().includes(search.toLowerCase());
		});
	};

	$: filteredCourses = filterCourses(courses);
</script>

{#if enableSearch}
	<input
		type="text"
		placeholder="Search..."
		class="m-1 border border-black p-1"
		bind:value={search}
		on:input={() => (filteredCourses = filterCourses(courses))}
	/>
{/if}
<table>
	<thead>
		<tr>
			<th> Code </th>
			<th> Median </th>
			<th> Points </th>
			<th> Name </th>
		</tr>
	</thead>
	<tbody>
		{#each filteredCourses as course}
			<tr class="hover:bg-yellow-200" on:mousedown={() => onClick(course)}>
				<td>{course.code}</td>
				<td>
					{course.info?.median?.toFixed(2) ?? 'N/A'}
				</td>
				<td>
					{course.info?.points}
				</td>
				<td>
					{course.info?.name ?? 'N/A'}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
