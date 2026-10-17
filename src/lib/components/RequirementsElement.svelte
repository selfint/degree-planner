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
	<div class="requirement-path">
		{#each reqGroup as req, i}
			{#if i > 0}<span class="path-separator" aria-hidden="true">/</span>{/if}
			<span title={content.lang.lang === 'he' ? req.he : req.en}
				>{formatName(req)}</span
			>
		{/each}
	</div>
{/each}

<style>
	.requirement-path {
		display: inline-flex;
		max-inline-size: 100%;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem;
		margin-block-start: 0.375rem;
		margin-inline-end: 0.375rem;
		padding: 0.25rem 0.5rem;
		border: 0.0625rem solid rgb(var(--color-border));
		border-radius: 0.5rem;
		background: rgb(var(--color-card-primary) / 0.55);
		line-height: 1.4;
		text-align: start;
		overflow-wrap: anywhere;
	}
	.path-separator {
		color: rgb(var(--color-content-secondary));
		opacity: 0.65;
	}
</style>
