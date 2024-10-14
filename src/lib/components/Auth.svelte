<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Nav from './Nav.svelte';

	type Props = {
		username?: string;
		onGetStarted: () => void;
	};

	let { username, onGetStarted }: Props = $props();
</script>

{#if username === undefined}
	<Button variant="primary" onclick={onGetStarted}>Get started</Button>
{:else}
	<Nav target="user">
		{username}
	</Nav>
{/if}
