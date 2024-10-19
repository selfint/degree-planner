<script lang="ts">
	import { generateRequirementColor } from '$lib/colors';
	import { content } from '$lib/stores.svelte';

	type Props = {
		requirements: Requirement[][];
		maxWidth?: number;
		slice?: number;
	};

	let { requirements, slice, maxWidth }: Props = $props();

	function formatName(requirement: Requirement): string {
		let name = requirement.name;

		if (requirement.he !== undefined && content.lang.lang === 'he') {
			name = requirement.he;
		}

		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.map((word) => {
				if (maxWidth !== undefined && word.length > maxWidth) {
					return (
						word.slice(0, maxWidth / 4) +
						'...' +
						word.slice((-maxWidth * 3) / 4)
					);
				} else {
					return word;
				}
			})
			.join(' ');
	}
</script>

{#each requirements ?? [] as requirementGroup}
	{@const reqGroup =
		slice === undefined ? requirementGroup : requirementGroup.slice(-slice)}
	<div
		class="me-1 mt-1 flex w-fit flex-row flex-wrap rounded-md text-start leading-none text-content-primary"
	>
		{#each reqGroup as req, i}
			{#if i === 0 && i === reqGroup.length - 1}
				<span
					class="rounded-e-md rounded-s-md pb-0.5 pe-1.5 ps-1.5 pt-0.5"
					style="background: {generateRequirementColor(req.name)}"
				>
					{formatName(req)}
				</span>
			{:else if i === 0}
				<span
					class="me-0.5 rounded-s-md pb-0.5 pe-1 ps-1.5 pt-0.5"
					style="background: {generateRequirementColor(req.name)}"
				>
					{formatName(req)}
				</span>
			{:else if i === reqGroup.length - 1}
				<span
					class="rounded-e-md pb-0.5 pe-1.5 ps-1 pt-0.5"
					style="background: {generateRequirementColor(req.name)}"
				>
					{formatName(req)}
				</span>
			{:else}
				<span
					class="me-0.5 pb-0.5 pe-1 ps-1 pt-0.5"
					style="background: {generateRequirementColor(req.name)}"
				>
					{formatName(req)}
				</span>
			{/if}
		{/each}
	</div>
{/each}
