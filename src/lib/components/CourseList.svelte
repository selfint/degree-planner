<script context="module" lang="ts">
	export type CourseRow = {
		course: Course;
		cssClass: string;
	};
</script>

<script lang="ts">
	export let rows: CourseRow[];
	export let onClick: (course: Course) => void = () => {};
	export let enableSearch = false;

	let search = '';

	const filterCourses = (rows: CourseRow[]) => {
		rows = rows.filter((row) => row.course.info?.name !== undefined);

		if (search.trim() === '') return rows;

		return rows.filter((row) => {
			return row.course.code.toLowerCase().includes(search.toLowerCase());
		});
	};

	$: filteredRows = filterCourses(rows);
</script>

{#if enableSearch}
	<input
		type="text"
		placeholder="Search..."
		class="m-1 border border-black p-1"
		bind:value={search}
		on:input={() => (filteredRows = filterCourses(rows))}
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
		{#each filteredRows as row}
			<tr class="hover:bg-yellow-200" on:mousedown={() => onClick(row.course)}>
				<td>{row.course.code}</td>
				<td>
					{row.course.info?.median?.toFixed(2) ?? 'N/A'}
				</td>
				<td>
					{row.course.info?.points}
				</td>
				<td>
					{row.course.info?.name ?? 'N/A'}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
