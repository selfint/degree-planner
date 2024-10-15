<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		loloco: [string, Course[]][];
		header: Snippet<[{ title: string }]>;
		children: Snippet<[{ course: Course; index: number }]>;
	};

	const { loloco, header, children }: Props = $props();
</script>

<div>
	{#each loloco as [title, courses]}
		<div class="pb-2">
			{@render header({ title })}

			<div class="flex flex-row space-x-2 overflow-x-auto pt-1">
				<div class="min-w-1"></div>
				{#each courses as course, index}
					{@render children({ course, index })}
				{/each}
			</div>
		</div>
	{/each}
</div>
