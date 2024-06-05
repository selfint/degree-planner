<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Nav from './Nav.svelte';

	export let userData: UserData | undefined;

	export let onGetStarted: () => void;
</script>

{#if userData === undefined}
	<Button variant="primary" onClick={onGetStarted}>Get started</Button>
{:else}
	<Nav target="user">
		{userData.username}
	</Nav>
{/if}
