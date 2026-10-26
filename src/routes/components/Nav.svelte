<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';

	type Props = {
		target: string;
		children: Snippet;
	};

	let { target, children }: Props = $props();

	const active = $derived(
		'/app/' + target === page.url.pathname.replace(/\/$/, '')
	);
</script>

<a
	href="/app/{target}"
	class="nav-link"
	class:active
	aria-current={active ? 'page' : undefined}
>
	{@render children()}
</a>

<style>
	.nav-link {
		display: inline-flex;
		min-block-size: 2.25rem;
		min-inline-size: 2.25rem;
		align-items: center;
		justify-content: center;
		padding: 0.375rem 0.5rem;
		border-radius: 0.375rem;
		color: rgb(var(--color-content-primary));
		font-size: var(--titlebar-font-size, 0.875rem);
		font-weight: 550;
		line-height: 1.5;
		white-space: nowrap;
	}
	@media (hover: hover) and (pointer: fine) {
		.nav-link:not(.active):hover {
			background: rgb(var(--color-card-primary));
			color: rgb(var(--color-content-primary));
		}
	}
	.nav-link.active {
		background: rgb(var(--color-accent-primary) / 0.12);
		color: rgb(var(--color-accent-primary));
	}
	@media (max-width: 39.99rem) {
		.nav-link {
			padding-inline: 0.25rem;
		}
	}
</style>
