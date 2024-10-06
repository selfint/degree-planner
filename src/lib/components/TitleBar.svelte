<script lang="ts">
	import Logo from '$lib/assets/logo.png';

	import Search from '$lib/components/Search.svelte';
	import Auth from '$lib/components/Auth.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import Burger from '$lib/components/Burger.svelte';

	export let username: string | undefined;
	export let onGetStarted: () => void;
	export let onSearch: (query: string) => void;

	let expanded = false;
</script>

<header
	class="touch-manipulation items-center border-b-2 border-border bg-background"
>
	<div class="flex flex-row items-center p-2">
		<a href="/" class="flex h-12 min-w-12 flex-row items-end">
			<img src={Logo} alt="Logo" class="h-12 w-12" />
		</a>
		<nav class="flex flex-row items-center">
			<a
				href="/"
				class="mr-4 hidden border-b-2 border-background text-2xl font-semibold tracking-tight text-content-primary lg:block"
			>
				Degree Planner
			</a>
			<div class="hidden flex-row items-baseline space-x-4 p-2 sm:flex">
				<Nav target="catalog">Catalog</Nav>
				<Nav target="overview">Overview</Nav>
				<Nav target="semester">Semester</Nav>
			</div>

			<div class="ml-2">
				<Search {onSearch} />
			</div>
		</nav>
		<div class="flex-grow" />
		<div class="items-baseline">
			<Auth {username} {onGetStarted} />
		</div>
		<button
			class="ml-2 w-8 text-card-secondary sm:hidden"
			on:click={() => (expanded = !expanded)}
		>
			<Burger />
		</button>
	</div>

	{#if expanded}
		<div class="m-3 mt-0 flex flex-row justify-between sm:hidden">
			<Nav target="catalog">Catalog</Nav>
			<Nav target="overview">Overview</Nav>
			<Nav target="semester">Semester</Nav>
		</div>
	{/if}
</header>
