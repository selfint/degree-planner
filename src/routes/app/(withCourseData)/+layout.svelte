<script lang="ts">
	import { page } from '$app/state';
	import { getContext, type Snippet } from 'svelte';
	import Catalog from '$lib/components/Catalog.svelte';
	import { PERSONAL_PLAN_READY } from '$lib/pwa/plan-visibility';

	let {
		data,
		children
	}: {
		data: { courseData: Promise<CourseData>; getCourseData: GetCourseData };
		children: Snippet;
	} = $props();
	const personalPlanReady =
		getContext<() => boolean>(PERSONAL_PLAN_READY) ?? (() => true);
	const active = $derived(page.route.id === '/app/(withCourseData)/catalog');
	// Keep one live catalog while visiting sibling routes. Release personal data
	// immediately when the account gate closes, and on leaving this route group.
	let retained = $state(false);
	$effect(() => {
		if (!personalPlanReady()) retained = false;
		else if (active) retained = true;
	});
</script>

{#if (active || retained) && personalPlanReady()}
	<div
		class:inactive={!active}
		inert={!active}
		aria-hidden={!active}
		data-catalog-cache
	>
		<Catalog {data} />
	</div>
{/if}
{@render children()}

<style>
	[data-catalog-cache] {
		contain: layout style paint;
	}
	/* Unlike display:none, skipping contents preserves layout work for the next
	   visit. Explicit inert also protects focus in WebKit when skipped layout is cached. */
	.inactive {
		content-visibility: hidden;
		block-size: 0;
		overflow: clip;
	}
	@supports not (content-visibility: hidden) {
		.inactive {
			display: none;
		}
	}
</style>
