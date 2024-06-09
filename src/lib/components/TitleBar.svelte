<script lang="ts">
	import Logo from '$lib/assets/logo.png';
	import Search from '$lib/components/Search.svelte';
	import Auth from '$lib/components/Auth.svelte';
	import Nav from '$lib/components/Nav.svelte';

	export let username: string | undefined;
	export let onGetStarted: () => void;
	export let onSearch: (query: string) => void;
</script>

<header class="flex flex-row items-center border-b-2 border-dark-400 p-2">
	<a href="/" class="flex flex-row items-end">
		<img src={Logo} alt="Logo" class="h-12" />
	</a>
	<nav class="flex flex-grow flex-row items-baseline space-x-8">
		<a
			href="/"
			class="border-b-2 border-background text-2xl font-semibold tracking-tight text-content-primary"
		>
			Degree Planner
		</a>
		<Nav target="catalog">Catalog</Nav>
		<Nav target="overview">Overview</Nav>
		<Nav target="semester">Semester</Nav>
		<Search {onSearch} />
	</nav>
	<div class="flex-grow" />
	<div class="items-baseline">
		<Auth {username} {onGetStarted} />
	</div>
</header>
