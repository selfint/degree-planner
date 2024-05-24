<script lang="ts">
	import { courses } from '$lib/stores';
</script>

<h2>Courses</h2>
<table>
	<thead>
		<tr>
			<th> Code </th>
			<th> Median </th>
			<th> Points </th>
			<th> Name </th>
			<th> Dependencies </th>
			<th> Adjacent </th>
			<th> Exclusive </th>
		</tr>
	</thead>
	<tbody>
		{#each $courses as course}
			<tr>
				<td>{course.code}</td>
				<td>
					{#if course.info?.median === undefined}
						N / A
					{:else}
						<span class="median">
							{course.info?.median.toFixed(2)}
						</span>
					{/if}
				</td>
				<td>
					{course.info?.points}
				</td>
				<td>
					{course.info?.name ?? 'N/A'}
				</td>
				<td>
					{course.info?.connections?.dependencies}
				</td>
				<td>
					{course.info?.connections?.adjacent}
				</td>
				<td>
					{course.info?.connections?.exclusive}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
