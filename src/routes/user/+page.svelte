<script lang="ts">
	import { username, degree } from '$lib/stores';

	import Button from '$lib/components/Button.svelte';
	import Select from '$lib/components/Select.svelte';

	$username = $username ?? 'guest';

	let degreeChoice = $degree;
	const degrees = [
		'Computer Science',
		'Electrical Engineering',
		'Biotechnology',
		'Material Engineering'
	];
</script>

<div class="flex flex-col space-y-8">
	<h1 class="text-2xl font-medium text-content-primary">
		Welcome, {$username}
	</h1>

	<div class="flex flex-col space-y-3">
		<h2 class="text-xl text-content-primary">Degree</h2>
		<div>
			<Select bind:value={degreeChoice}>
				{#if $degree === undefined && degreeChoice === undefined}
					<option value={undefined}>Select a degree</option>
				{/if}
				{#each degrees as degree}
					<option value={degree}>{degree}</option>
				{/each}
			</Select>
			{#if degreeChoice !== $degree}
				<Button variant="primary" onClick={() => ($degree = degreeChoice)}>Save</Button>
				<Button variant="secondary" onClick={() => (degreeChoice = $degree)}>Cancel</Button>
			{/if}
		</div>
	</div>
</div>
