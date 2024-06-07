<script lang="ts">
	import { username, degree, degreeData } from '$lib/stores';

	import DegreeSection from './components/DegreeSection.svelte';

	import { loadDegreeData } from '$lib/requirements';

	$username = $username ?? 'guest';

	// we can't trust svelte to notify us when the degree value *actually*
	// changes, so we need to keep track of it ourselves
	// this is *the only* place where we should be setting the degree value
	function onChange(newDegree: Degree): boolean {
		$degreeData = loadDegreeData(newDegree);
		$degree = newDegree;

		return true;
	}
</script>

<div class="flex flex-col space-y-8">
	<h1 class="text-2xl font-medium text-content-primary">
		Welcome, {$username}
	</h1>

	<div class="flex flex-col space-y-3">
		<DegreeSection degree={$degree} {onChange} />
	</div>

	{#if $degreeData !== undefined}
		<div class="flex flex-col space-y-3">
			<h2 class="text-xl font-medium text-content-primary">Requirements</h2>
			{#await $degreeData}
				<div class="text-content-secondary">Loading...</div>
			{:then requirements}
				<span class="text-content-secondary">
					{JSON.stringify(requirements, null, 4)}
				</span>
			{:catch error}
				<div class="text-content-secondary">Error: {error.message}</div>
			{/await}
		</div>
	{/if}
</div>
