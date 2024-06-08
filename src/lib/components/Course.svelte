<script lang="ts">
	export let code: string;
	export let data: Course;
	export let lists: Promise<string[]> | undefined;

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => {
				return word[0].toUpperCase() + word.slice(1).toLowerCase();
			})
			.join(' ');
	}
</script>

<div
	class="flex h-fit w-56 flex-col justify-between space-y-2 rounded-md bg-card-primary p-2 leading-none"
>
	<div class="flex flex-row items-baseline justify-between">
		<div>
			<span class="m-0 p-0 text-xs text-content-primary" dir="rtl">
				{data.name?.split(' - ')[1] ?? code}
			</span>
			{#if data.name !== undefined}
				<span class="text-xs text-content-secondary">
					{code}
				</span>
			{/if}
		</div>
		<div class="m-0 ml-1 flex h-full flex-col items-start justify-start p-0">
			<div class="h-4 w-4 rounded-full bg-accent-primary" />
		</div>
	</div>

	<div class="flex flex-row items-baseline">
		<div class="flex flex-row items-baseline space-x-1">
			{#await lists then list}
				{#each list ?? [] as item}
					<div
						class="rounded-md bg-card-secondary pb-0.5 pl-2 pr-2 leading-none"
					>
						<span class="text-xs leading-none text-content-primary">
							{formatName(item)}
						</span>
					</div>
				{/each}
			{/await}
		</div>
		<div class="flex-grow" />
		<div class="text-xs text-content-secondary">
			<span class="mr-2">{data.median ?? 'N/A'}</span>
			<span>{data.points ?? 'N/A'}</span>
		</div>
	</div>
</div>
