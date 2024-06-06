<script lang="ts">
	import { username, degree } from '$lib/stores';

	import Degree from './components/Degree.svelte';

	$username = $username ?? 'guest';

	$: requirements =
		$degree === undefined
			? undefined
			: fetch(`/api/catalog/${$degree[0]}/${$degree[1]}/${$degree[2]}`).then((res) => res.json());
</script>

<div class="flex flex-col space-y-8">
	<h1 class="text-2xl font-medium text-content-primary">
		Welcome, {$username}
	</h1>

	<div class="flex flex-col space-y-3">
		<Degree bind:degree={$degree} />
	</div>

	{#if requirements !== undefined}
		<div class="flex flex-col space-y-3">
			<h2 class="text-xl font-medium text-content-primary">Requirements</h2>
			<span class="text-content-secondary">
				{#await requirements}
					<progress />
				{:then requirements}
					{JSON.stringify(requirements)}
				{/await}
			</span>
		</div>
	{/if}
</div>
