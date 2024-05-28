<script lang="ts" context="module">
	export type CourseError = {
		generic: string | undefined;
		dependencies: string[][];
		adjacencies: string[];
		exclusives: string[];
	};
</script>

<script lang="ts">
	export let course: Course;
	export let courseError: CourseError;
</script>

<li class="flex flex-col">
	<p class="text-sm text-white">{course.code}:</p>
	{#if courseError.generic !== undefined}
		<p class="pl-1 text-sm text-white">{courseError.generic}</p>
	{/if}
	{#if courseError.dependencies.some((deps) => deps.length > 0)}
		<p class="pl-1 text-sm text-white">
			Missing dependencies:
			{#each courseError.dependencies.filter((d) => d.length > 0) as missingDependencies, i}
				{#if i > 0}
					or
				{/if}
				<span>
					{#each missingDependencies as dependency, j}
						{#if j > 0}
							,
						{/if}
						<span>
							{dependency}
						</span>
					{/each}
				</span>
			{/each}
		</p>
	{/if}
	{#if courseError.adjacencies.length > 0}
		<p class="pl-1 text-sm text-white">
			Missing adjacencies:
			{#each courseError.adjacencies as missingAdjacency, i}
				{#if i > 0}
					or
				{/if}
				<span>
					{missingAdjacency}
				</span>
			{/each}
		</p>
	{/if}
	{#if courseError.exclusives.length > 0}
		<p class="pl-1 text-sm text-white">
			Present exclusives:
			{#each courseError.exclusives as presentExclusive, i}
				{#if i > 0}
					or
				{/if}
				<span>
					{presentExclusive}
				</span>
			{/each}
		</p>
	{/if}
</li>
