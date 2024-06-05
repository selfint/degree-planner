<script lang="ts">
	import { page } from '$app/stores';

	import Logo from '$lib/assets/logo.png';
	import Search from '$lib/components/Search.svelte';
	import Button from '$lib/components/Button.svelte';

	$: borders = new Map<string, string>(
		['catalog', 'overview', 'semester'].map((path) => [
			path,
			'/' + path === $page.url.pathname ? 'border-b-2 border-accent-primary' : ''
		])
	);
</script>

<header class="flex flex-row items-center border-b-2 border-dark-400 p-2">
	<a href="/" class="flex flex-row items-end">
		<img src={Logo} alt="Logo" class="h-12" />
	</a>
	<nav class="flex flex-grow flex-row items-baseline space-x-8">
		<a
			href="/"
			class="border-b-2 border-background text-4xl font-semibold tracking-tight text-content-primary"
		>
			Degree Planner
		</a>
		<a href="/catalog" class="{borders.get('catalog')} text-2xl font-thin text-content-primary">
			Catalog
		</a>
		<a href="/overview" class="{borders.get('overview')} text-2xl font-thin text-content-primary">
			Overview
		</a>
		<a href="/semester" class="{borders.get('semester')} text-2xl font-thin text-content-primary">
			Semester
		</a>
		<Search onSearch={() => {}} />
	</nav>
	<div class="flex-grow" />
	<div>
		<Button variant="primary" onClick={() => {}}>Get started</Button>
	</div>
</header>
