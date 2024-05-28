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
	<p class="text-sm text-white">{course.info?.name ?? course.code}:</p>
	<ol>
		{#if courseError.generic !== undefined}
			<li class="pl-1 text-sm text-white">{courseError.generic}</li>
		{/if}
		{#if courseError.dependencies.some((deps) => deps.length > 0)}
			<li class="pl-1 text-sm text-white">
				<p>Missing dependencies:</p>
				<ul>
					{#each courseError.dependencies.filter((d) => d.length > 0) as missingDependencies}
						<li class="pl-1">
							<span>
								{#each missingDependencies as dependency, j}
									{#if j > 0}
										,
									{/if}
									<span>{dependency}</span>
								{/each}
							</span>
						</li>
					{/each}
				</ul>
			</li>
		{/if}
		{#if courseError.adjacencies.length > 0}
			<li class="pl-1 text-sm text-white">
				<p>Missing adjacencies:</p>
				<ul>
					{#each courseError.adjacencies as missingAdjacency}
						<li class="pl-1">
							{missingAdjacency}
						</li>
					{/each}
				</ul>
			</li>
		{/if}
		{#if courseError.exclusives.length > 0}
			<li class="pl-1 text-sm text-white">
				Present exclusives:
				<ul>
					{#each courseError.exclusives as presentExclusive}
						<span>
							{presentExclusive}
						</span>
					{/each}
				</ul>
			</li>
		{/if}
	</ol>
</li>
