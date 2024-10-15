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
				{#each courses as course, index}
					<div class="{index > 0 ? 'ml-2' : 'ml-3'} sm:ml-0">
						{@render children({ course, index })}
					</div>
				{/each}
				<div class="min-w-0"></div>
			</div>
		</div>
	{/each}
</div>
