<script lang="ts">
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
	<nav class="items-center lg:flex lg:flex-row lg:space-x-8">
		<a
			href="/"
			class="border-b-2 border-background text-2xl font-semibold tracking-tight text-content-primary"
		>
			Degree Planner
		</a>
		<div
			class="mb-2 mt-2 flex flex-row flex-wrap items-baseline space-x-2 lg:m-0 lg:flex-nowrap lg:space-x-8"
		>
			<Nav target="catalog">Catalog</Nav>
			<Nav target="overview">Overview</Nav>
			<Nav target="semester">Semester</Nav>
		</div>
		<Search {onSearch} />
	</nav>
	<div class="flex-grow" />
	<div class="items-baseline">
		<Auth {username} {onGetStarted} />
	</div>
</header>
