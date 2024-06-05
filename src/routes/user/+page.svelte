<script lang="ts">
	import { username, plan } from '$lib/stores';

	import Plan from './components/Plan.svelte';

	$username = $username ?? 'guest';
</script>

<div class="flex flex-col space-y-8">
	<h1 class="text-2xl font-medium text-content-primary">
		Welcome, {$username}
	</h1>

	<div class="flex flex-col space-y-3">
		<Plan {plan} />
	</div>
</div>
