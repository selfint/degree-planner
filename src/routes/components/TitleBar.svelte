<script lang="ts">
	import Logo from '$lib/assets/logo.webp';

	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import Button from '$lib/components/Button.svelte';

	import Nav from './Nav.svelte';

	import { getLang } from '$lib/content';

	type Props = {
		started: boolean;
		onGetStarted: () => void;
		onSearch: (query: string) => void;
	};

	const { started, onGetStarted, onSearch }: Props = $props();

	const lang = getLang();

	let query = $state('');
	let placeholder = $state(lang.header.searchPlaceholder);

	let selected = $state(false);
	const textStyle = $derived(
		selected ? 'text-content-primary' : 'text-content-secondary'
	);

	function onsubmit(e: Event) {
		e.preventDefault();
		onSearch(query);
	}
</script>

<header class="touch-manipulation items-center pt-1">
	<div class="flex flex-row items-center justify-between pl-2 pr-3">
		<a href="/" class="flex h-12 min-w-12 flex-row items-center">
			<img src={Logo} alt="Logo" class="h-12 w-12" />
			<span
				class="mr-4 {started
					? 'hidden sm:inline'
					: ''} border-b-2 border-background text-2xl font-semibold tracking-tight text-content-primary"
			>
				{lang.header.name}
			</span>
		</a>
		<div class="flex-grow"></div>
		{#if !started}
			<Button variant="primary" onmousedown={onGetStarted}>
				{lang.common.getStarted}
			</Button>
		{:else}
			<nav
				class="flex flex-row items-center justify-end space-x-3 md:space-x-8"
			>
				<div
					class="flex h-fit w-fit flex-row items-center justify-start rounded-md bg-card-primary pb-1 pl-2 pr-1 pt-1 {textStyle}"
				>
					<div class="min-w-3">
						<SearchIcon class="h-3" />
					</div>
					<form class="ml-1" {onsubmit}>
						<input
							type="text"
							{placeholder}
							onfocus={() => {
								selected = true;
								placeholder = '';
							}}
							onblur={() => {
								selected = false;
								placeholder = 'Search';
							}}
							bind:value={query}
							class="w-full max-w-28 border-none bg-transparent font-thin {textStyle} focus:outline-none"
						/>
					</form>
				</div>
				<Nav target="catalog">{lang.header.catalog}</Nav>
				<Nav target="plan">{lang.header.plan}</Nav>
				<Nav target="progress">{lang.header.progress}</Nav>
			</nav>
		{/if}
	</div>
</header>
