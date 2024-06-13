<script lang="ts">
	export let loloco: [string, Course[]][];
</script>

<div>
	{#each loloco as [title, courses]}
		<div class="pb-2">
			<slot name="header" {title} />

			<div class="flex flex-row space-x-2 overflow-x-auto pt-1">
				{#each courses as course, i}
					<slot name="course" {course} {i} />
				{/each}
			</div>
		</div>
	{/each}
</div>
