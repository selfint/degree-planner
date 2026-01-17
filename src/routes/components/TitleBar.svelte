<script lang="ts">
	import Logo from '$lib/assets/logo.webp?enhanced';
	import Title from '$lib/assets/Title.svg?raw';

	import SearchIcon from '$lib/components/SearchIcon.svelte';

	import Nav from './Nav.svelte';

	import { content } from '$lib/stores.svelte';
	import Settings from '$lib/components/Settings.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';

	type Props = {
		started: boolean;
		onGetStarted: () => Promise<void>;
		onSearch: (query: string) => void;
	};

	const { started, onGetStarted, onSearch }: Props = $props();

	let query = $state('');
	let placeholder: string = $state(content.lang.header.searchPlaceholder);

	$effect(() => {
		placeholder = content.lang.header.searchPlaceholder;
	});

	let selected = $state(false);
	const textStyle = $derived(
		selected ? 'text-content-primary' : 'text-content-secondary'
	);

	function onsubmit(e: Event) {
		e.preventDefault();
		onSearch(query);
	}
</script>

<header
	dir="ltr"
	class="flex max-h-14 touch-manipulation flex-row items-center justify-between pe-3 ps-2 pt-1"
>
	<a href="/" class="flex h-12 min-w-12 flex-row items-center">
		<enhanced:img
			src={Logo}
			loading="lazy"
			alt="Logo"
			class="h-12 min-w-5 max-w-12"
		/>
		{#if !started}
			<span class="min-w-20 text-content-primary">
				{@html Title}
			</span>
		{:else}
			<span class="hidden min-w-20 text-content-primary sm:inline">
				{@html Title}
			</span>
		{/if}
	</a>
	<div class="flex-grow"></div>
	{#if !started}
		<AsyncButton variant="primary" onclick={onGetStarted}>
			{content.lang.common.getStarted}
		</AsyncButton>
	{:else}
		<nav
			class="ms-2 flex h-12 flex-row items-center justify-end space-x-3 overflow-y-hidden md:space-x-8"
		>
			<div
				dir={content.lang.dir}
				class="flex max-h-10 w-fit flex-row items-center justify-start overflow-y-hidden rounded-md bg-card-primary p-1 ps-2 {textStyle}"
			>
				<div class="h-fit max-h-10 min-w-3 overflow-y-hidden">
					<SearchIcon class="h-full" />
				</div>
				<form class="ms-1 h-10 max-h-10" {onsubmit}>
					<input
						type="text"
						{placeholder}
						onfocus={() => {
							selected = true;
							placeholder = '';
						}}
						onblur={() => {
							selected = false;
							placeholder = content.lang.header.searchPlaceholder;
						}}
						bind:value={query}
						class="h-10 max-h-10 w-full max-w-28 resize-none border-none bg-transparent py-0 font-thin leading-10 {textStyle} focus:outline-none"
					/>
				</form>
			</div>
			<Nav target="catalog">{content.lang.header.catalog}</Nav>
			<Nav target="plan">{content.lang.header.plan}</Nav>
			<Nav target="settings">
				<div class="p-0.5 pl-0 pr-0">
					<Settings></Settings>
				</div>
			</Nav>
		</nav>
	{/if}
</header>
