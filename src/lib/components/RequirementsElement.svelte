<script lang="ts">
	import { content } from '$lib/stores.svelte';

	type Props = {
		requirements: Requirement[][];
		maxWidth?: number;
		slice?: number;
	};

	let { requirements, slice, maxWidth }: Props = $props();

	function formatName(requirement: Requirement): string {
		let name = content.lang.lang === 'he' ? requirement.he : requirement.en;

		name = name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');

		if (maxWidth !== undefined && name.length > maxWidth + 2) {
			return name.slice(0, 1) + '..' + name.slice(-maxWidth);
		} else {
			return name;
		}
	}
</script>

{#each requirements ?? [] as requirementGroup}
	{@const reqGroup =
		slice === undefined ? requirementGroup : requirementGroup.slice(-slice)}
	<div class="me-1 mt-1 flex w-fit flex-row flex-wrap rounded-md text-start leading-none">
		{#each reqGroup as req, i}
			{#if i === 0 && i === reqGroup.length - 1}
				<span class="rounded-e-md rounded-s-md pb-0.5 pe-1.5 pt-0.5">
					{formatName(req)}
				</span>
			{:else if i === 0}
				<span class="me-0.5 rounded-s-md pb-0.5 pe-1 pt-0.5">
					{formatName(req)}
				</span>
			{:else if i === reqGroup.length - 1}
				<span class="rounded-e-md pb-0.5 pe-1.5 pt-0.5">
					{formatName(req)}
				</span>
			{:else}
				<span class="me-0.5 pb-0.5 pe-1 pt-0.5">
					{formatName(req)}
				</span>
			{/if}
		{/each}
	</div>
{/each}
