<script lang="ts">
	import { generateColor } from '$lib/colors';
	import { content } from '$lib/stores.svelte';

	type Props = {
		scheduleError: ScheduleError;
	};

	let { scheduleError }: Props = $props();
</script>

{#if scheduleError.season !== undefined}
	<div class="items-baseline p-2 pb-1 pt-1">
		<h2 class="text-start text-sm text-content-primary">
			{content.lang.common.semester}
		</h2>
		<div class="flex w-full flex-row justify-start">
			{#each scheduleError.season as season}
				<p class="me-2 text-center text-xs text-content-secondary">
					{content.lang.common.seasons[season]}
				</p>
			{/each}
		</div>
	</div>
{/if}
{#if scheduleError.dependencies.length > 0}
	<div class="p-2 pb-1 pt-1">
		<h2 class="text-start text-sm text-content-primary">
			{content.lang.common.dependencies}
		</h2>
		<div class="mb-0 gap-y-2 text-start text-xs">
			{#each scheduleError.dependencies as group, i}
				{#if i !== 0}
					<p class="w-full text-center text-content-secondary">
						{content.lang.common.or}
					</p>
				{/if}
				<div>
					{#each group as { course: dep, taken }}
						<div class="flex flex-row justify-start text-content-primary">
							<div
								style="background: {generateColor(dep.code)}"
								class="me-1 mt-0.5 h-3 w-3 min-w-3 {dep.tests
									? 'rounded-full'
									: ''}"
							></div>
							<div class="flex flex-row flex-wrap gap-x-1 overflow-hidden">
								<div class="truncate">
									<span dir="rtl">
										{#if taken}
											<span class="line-through">
												{dep.name}
											</span>
										{:else}
											<span>
												{dep.name}
											</span>
										{/if}
									</span>
								</div>
								<span class="flex-nowrap text-content-secondary">
									{dep.code}
								</span>
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
		<h2 class="text-start text-sm text-content-primary">Adjacencies</h2>
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
							style="background: {generateColor(adj.code)}"
							class="h-4 w-4 min-w-4 {adj.tests ? 'rounded-full' : ''}"
						></div>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

{#if scheduleError.exclusives.length > 0}
	<div class="p-2 pb-1 pt-1">
		<h2 class="text-start text-sm text-content-primary">
			{content.lang.common.exclusives}
		</h2>
		<div class="space-y-1 text-start text-xs">
			{#each scheduleError.exclusives as course}
				<div class="text-content-primary">
					<div class="flex flex-row justify-between">
						<div>
							<span dir="rtl">
								{course.name}
							</span>
							<span class="text-content-secondary">
								{course.code}
							</span>
						</div>
						<div
							style="background: {generateColor(course.code)}"
							class="h-4 w-4 min-w-4 {course.tests ? 'rounded-full' : ''}"
						></div>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
