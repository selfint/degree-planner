<script lang="ts">
	import { onMount } from 'svelte';
	import ConsoleLoading from '$lib/components/ConsoleLoading.svelte';
	import { content } from '$lib/preferences.svelte';
	import type { ConsoleLoadingState } from '$lib/consoleLoading';
	let {
		scenario = 'cold'
	}: { scenario?: 'cold' | 'paused' | 'cached' | 'unknown' | 'error' } =
		$props();
	const totalBytes = 4_101_976;
	const data = (
		bytesRead: number,
		activity: 'reading' | 'processing' | 'saving' = 'reading'
	): ConsoleLoadingState => ({
		phase: 'data',
		// The small catalog is persisted first; the course file still needs processing/saving.
		completed: bytesRead >= 177_495 ? 1 : 0,
		total: 2,
		pending:
			bytesRead >= 177_495
				? ['/courseData.json']
				: ['/courseData.json', '/catalogs.json'],
		bytesRead,
		...(scenario === 'unknown' ? {} : { totalBytes }),
		activity
	});
	const steps = $derived(
		scenario === 'error'
			? [
					{
						at: 0,
						label: 'Opening',
						state: { phase: 'opening' } as ConsoleLoadingState
					},
					{
						at: 1000,
						label: 'Reading data',
						state: data(Math.round(totalBytes * 0.28))
					},
					{
						at: 3000,
						label: 'Download failed — no claimed completion',
						state: { phase: 'error' } as ConsoleLoadingState
					}
				]
			: scenario === 'cached'
				? [
						{
							at: 0,
							label: 'Checking cached data',
							state: { phase: 'checking' } as ConsoleLoadingState
						},
						{
							at: 900,
							label: 'Account / update readiness (no download)',
							state: { phase: 'finishing' } as ConsoleLoadingState
						},
						{
							at: 1500,
							label: 'Checking updates',
							state: {
								phase: 'finishing',
								accountReady: true
							} as ConsoleLoadingState
						},
						{
							at: 2200,
							label: 'Ready',
							state: { phase: 'ready' } as ConsoleLoadingState
						},
						{ at: 2500, label: 'Planner open', state: null }
					]
				: [
						{
							at: 0,
							label: 'Opening',
							state: { phase: 'opening' } as ConsoleLoadingState
						},
						{
							at: 700,
							label: 'Checking saved data',
							state: { phase: 'checking' } as ConsoleLoadingState
						},
						...Array.from({ length: 41 }, (_, i) => i / 40).map((n, i) => ({
							at: 1200 + i * 75 + (scenario === 'paused' && i >= 12 ? 2200 : 0),
							label:
								scenario === 'paused' && i === 11
									? 'Network pause — bytes stay still'
									: 'Reading data',
							state: data(Math.round(totalBytes * n))
						})),
						{
							at: 4500 + (scenario === 'paused' ? 2200 : 0),
							label: 'Processing data',
							state: data(totalBytes, 'processing')
						},
						{
							at: 5500 + (scenario === 'paused' ? 2200 : 0),
							label: 'Saving data offline',
							state: data(totalBytes, 'saving')
						},
						{
							at: 6500 + (scenario === 'paused' ? 2200 : 0),
							label: 'Account / update readiness',
							state: {
								phase: 'finishing',
								...(scenario === 'unknown'
									? {}
									: { download: { bytesRead: totalBytes, totalBytes } })
							} as ConsoleLoadingState
						},
						{
							at: 7300 + (scenario === 'paused' ? 2200 : 0),
							label: 'Checking updates',
							state: {
								phase: 'finishing',
								accountReady: true
							} as ConsoleLoadingState
						},
						{
							at: 8100 + (scenario === 'paused' ? 2200 : 0),
							label: 'Ready',
							state: { phase: 'ready' } as ConsoleLoadingState
						},
						{
							at: 8500 + (scenario === 'paused' ? 2200 : 0),
							label: 'Planner open',
							state: null
						}
					]
	);
	let elapsed = $state(0);
	let playing = $state(true);
	const current = $derived(
		[...steps].reverse().find((step) => elapsed >= step.at) ?? steps[0]
	);
	onMount(() => {
		const timer = setInterval(() => {
			if (playing) elapsed = Math.min(elapsed + 50, steps.at(-1)!.at);
		}, 50);
		return () => clearInterval(timer);
	});
	function replay() {
		elapsed = 0;
		playing = true;
	}
	function next() {
		playing = false;
		elapsed =
			steps.find(
				(step) =>
					step.at > elapsed &&
					(step.state?.phase !== current.state?.phase ||
						step.state?.accountReady !== current.state?.accountReady ||
						(step.state?.phase === 'data' &&
							current.state?.phase === 'data' &&
							step.state.activity !== current.state.activity))
			)?.at ?? steps.at(-1)!.at;
	}
</script>

<div class="flow-demo" data-flow-phase={current.label}>
	<header dir="ltr">
		<strong>Startup loading — replayable example</strong>
		<p>
			Simulated timings, real loading component. A network pause never advances
			the download.
		</p>
		<nav aria-label="Flow playback">
			<button onclick={replay}>Replay</button>
			<button onclick={() => (playing = !playing)}
				>{playing ? 'Pause' : 'Play'}</button
			>
			<button onclick={next}>Next phase</button>
			<output>{current.label}</output>
		</nav>
	</header>
	{#if current.state}<ConsoleLoading
			state={current.state}
			language={content.lang.lang}
			direction={content.lang.dir}
		/>
	{:else}<div class="ready" role="status">
			{content.lang.lang === 'he' ? 'המתכנן מוכן' : 'Planner ready'}
		</div>{/if}
</div>

<style>
	header {
		padding: 0.75rem;
		min-block-size: 9rem;
		box-sizing: border-box;
	}
	p {
		font-size: 0.8rem;
		margin: 0.3rem 0;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	button {
		border: 1px solid currentColor;
		border-radius: 0.4rem;
		padding: 0.25rem 0.6rem;
	}
	output {
		flex-basis: 100%;
		font-size: 0.8rem;
	}
	.flow-demo :global(.console-loading),
	.ready {
		min-block-size: calc(100svh - 9rem);
	}
	.ready {
		display: grid;
		place-items: center;
	}
</style>
