<script lang="ts">
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { inject } from '@vercel/analytics';

	import '../app.css';

	import { username, storesHook, loadStores } from '$lib/stores';
	import { goto, afterNavigate, beforeNavigate } from '$app/navigation';
	import { onMount } from 'svelte';

	import { browser } from '$app/environment';

	import TitleBar from '$lib/components/TitleBar.svelte';

	import { degreeData } from '$lib/stores';
	import { getDegreeRequirementCourses } from '$lib/requirements';
	import { getCourseDataBatch } from '$lib/courseData';

	injectSpeedInsights();
	inject();

	function onGetStarted() {
		goto('/user');
	}

	function loadData(): AbortController {
		const abort = new AbortController();
		const abortSignal = abort.signal;

		// lazily load all courses from the degree requirements
		$degreeData
			?.then((d) => getDegreeRequirementCourses(d.requirements))
			.catch(() => [])
			.then((ls) => ls.flatMap((l) => l.courses))
			.then((courses) => getCourseDataBatch(courses))
			.catch(() => {});

		return abort;
	}

	let abort: AbortController | undefined = loadData();

	beforeNavigate(() => {
		abort?.abort('navigating');
		abort = undefined;
	});

	afterNavigate(() => {
		abort = loadData();
	});

	onMount(() => {
		if (browser) {
			loadStores();
		}

		storesHook();
	});
</script>

<div class="w-full bg-background">
	<TitleBar
		username={$username}
		{onGetStarted}
		onSearch={(query) => goto(`/search?q=${query}`)}
	/>
</div>

<slot />

<style lang="postcss">
	:global(body) {
		@apply bg-background;
		overscroll-behavior-y: none;
	}
</style>
