<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Nav from './Nav.svelte';

	type Props = {
		username?: string;
		onclick: () => void;
	};

	let { username, onclick }: Props = $props();
</script>

{#if username === undefined}
	<Button variant="primary" {onclick}>Get started</Button>
{:else}
	<Nav target="user">
		{username}
	</Nav>
{/if}
