<script lang="ts">
	import Logo from '$lib/assets/logo.webp';

	import Search from '$lib/components/Search.svelte';
	import Auth from '$lib/components/Auth.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import Burger from '$lib/components/Burger.svelte';

	type Props = {
		username?: string;
		onGetStarted: () => void;
		onSearch: (query: string) => void;
	};

	const { username, onGetStarted, onSearch }: Props = $props();
</script>

<header
	class="touch-manipulation items-center border-b-2 border-border bg-background"
>
	<div class="flex flex-row items-center justify-between p-2">
		<a href="/" class="flex h-12 min-w-12 flex-row items-center">
			<img src={Logo} alt="Logo" class="h-12 w-12" />
			<span
				class="mr-4 {username === undefined
					? ''
					: 'hidden sm:inline'} border-b-2 border-background text-2xl font-semibold tracking-tight text-content-primary"
			>
				Degree Planner
			</span>
		</a>
		<div class="flex-grow"></div>
		{#if username === undefined}
			<div class="ml-2">
				<Auth {username} {onGetStarted} />
			</div>
		{:else}
			<nav class="flex flex-row items-center justify-end">
				<div class="mr-4">
					<Search onsubmit={onSearch} />
				</div>
				<div class="mr-4">
					<Nav target="catalog">Catalog</Nav>
				</div>
				<div class="mr-4">
					<Nav target="plan">Plan</Nav>
				</div>
				<div class="mr-4">
					<Nav target="user">Progress</Nav>
				</div>
			</nav>
		{/if}
	</div>
</header>
