<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import Logo from '$lib/assets/logo.png';

	import Search from '$lib/components/Search.svelte';
	import Auth from '$lib/components/Auth.svelte';
	import Nav from '$lib/components/Nav.svelte';

	export let username: string | undefined;
	export let onGetStarted: () => void;
	export let onSearch: (query: string) => void;
</script>

<header
	class="flex flex-row items-center border-b-2 border-dark-400 bg-background p-2"
>
	<a href="/" class="flex h-12 min-w-12 flex-row items-end">
		<img src={Logo} alt="Logo" class="h-12 w-12" />
	</a>
	<nav class="flex flex-row items-center">
		<a
			href="/"
			class="mr-4 hidden border-b-2 border-background text-2xl font-semibold tracking-tight text-content-primary md:block"
		>
			Degree Planner
		</a>
		<div class="hidden flex-row items-baseline space-x-4 p-2 lg:m-0 lg:flex">
			<Nav target="catalog">Catalog</Nav>
			<Nav target="overview">Overview</Nav>
			<Nav target="semester">Semester</Nav>
		</div>
		<select
			class="appearance-none border-b-2 border-accent-primary bg-transparent text-2xl font-thin text-content-primary focus:outline-none lg:hidden"
			value={$page.url.pathname}
			on:change={(e) => goto(`${e.target.value}`)}
		>
			<option value="/">Home</option>
			<option value="/catalog">Catalog</option>
			<option value="/overview">Overview</option>
			<option value="/semester">Semester</option>
		</select>

		<div class="ml-4">
			<Search {onSearch} />
		</div>
	</nav>
	<div class="flex-grow" />
	<div class="items-baseline">
		<Auth {username} {onGetStarted} />
	</div>
</header>
