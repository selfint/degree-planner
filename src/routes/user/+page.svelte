<script lang="ts">
	import { username, degree, requirements } from '$lib/stores';

	import Degree from './components/Degree.svelte';

	$username = $username ?? 'guest';
</script>

<div class="flex flex-col space-y-8">
	<h1 class="text-2xl font-medium text-content-primary">
		Welcome, {$username}
	</h1>

	<div class="flex flex-col space-y-3">
		<Degree bind:degree={$degree} />
	</div>

	{#if $requirements !== undefined}
		<div class="flex flex-col space-y-3">
			<h2 class="text-xl font-medium text-content-primary">Requirements</h2>
			<span class="text-content-secondary">
				{JSON.stringify($requirements)}
			</span>
		</div>
	{/if}
</div>
