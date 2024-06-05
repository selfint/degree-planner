<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Nav from './Nav.svelte';

	export let username: string | undefined;

	export let onGetStarted: () => void;
</script>

{#if username === undefined}
	<Button variant="primary" onClick={onGetStarted}>Get started</Button>
{:else}
	<Nav target="user">
		{username}
	</Nav>
{/if}
