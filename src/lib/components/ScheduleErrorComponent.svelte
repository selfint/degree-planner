<script lang="ts">
	import { generateCourseColor } from '$lib/colors';
	import type { ScheduleError } from '$lib/schedule';
	import { content } from '$lib/stores.svelte';

	type Props = {
		scheduleError: ScheduleError;
	};

	let { scheduleError }: Props = $props();
</script>

{#if scheduleError.season !== undefined}
	<div class="items-baseline p-2 pb-1 pt-1">
		<h2 class="text-start text-base text-content-primary">
			{content.lang.common.semester}
		</h2>
		<div class="flex w-full flex-row justify-start">
			{#each scheduleError.season as season}
				<p class="mr-2 text-center text-xs text-content-secondary">
					{content.lang.common.seasons[season]}
				</p>
			{/each}
		</div>
	</div>
{/if}
{#if scheduleError.dependencies.length > 0}
	<div class="p-2 pb-1 pt-1">
		<h2 class="text-start text-base text-content-primary">
			{content.lang.common.dependencies}
		</h2>
		<div class="mb-2 space-y-2 text-start text-xs">
			{#each scheduleError.dependencies as group, i}
				{#if i !== 0}
					<p class="w-full text-center text-content-secondary">
						{content.lang.common.or}
					</p>
				{/if}
				<div class="space-y-1">
					{#each group as { course: dep, taken }}
						<div class="text-content-primary">
							<div class="flex flex-row justify-between">
								<div>
									{#if taken}
										<span dir="rtl" class="line-through">
											{dep.name}
										</span>
									{:else}
										<span dir="rtl">
											{dep.name}
										</span>
									{/if}
									<span class="text-content-secondary">
										{dep.code}
									</span>
								</div>
								<div
									style="background: {generateCourseColor(dep)}"
									class="h-4 w-4 min-w-4 {dep.tests ? 'rounded-full' : ''}"
								></div>
							</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
{/if}

{#if scheduleError.adjacencies.length > 0}
	<div class="p-2 pb-1 pt-1">
		<h2 class="text-start text-base text-content-primary">Adjacencies</h2>
		<div class="space-y-1 text-start text-xs">
			{#each scheduleError.adjacencies as { course: adj, taken }}
				<div class="text-content-primary">
					<div class="flex flex-row justify-between">
						<div>
							{#if taken}
								<span dir="rtl" class="line-through">
									{adj.name}
								</span>
							{:else}
								<span dir="rtl">
									{adj.name}
								</span>
							{/if}
							<span class="text-content-secondary">
								{adj.code}
							</span>
						</div>
						<div
							style="background: {generateCourseColor(adj)}"
							class="h-4 w-4 {adj.tests ? 'rounded-full' : ''}"
						></div>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
