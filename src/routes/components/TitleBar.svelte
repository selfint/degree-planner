<script lang="ts">
	import Logo from '$lib/assets/logo.webp';

	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import Button from '$lib/components/Button.svelte';

	import Nav from './Nav.svelte';

	import { content } from '$lib/stores.svelte';
	import Settings from '$lib/components/Settings.svelte';

	type Props = {
		started: boolean;
		onGetStarted: () => void;
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

<header dir="ltr" class="touch-manipulation items-center pt-1">
	<div class="flex flex-row items-center justify-between pe-3 ps-2">
		<a href="/" class="flex h-12 min-w-12 flex-row items-center">
			<img src={Logo} alt="Logo" class="h-12 w-12" />
			{#if !started}
				<span
					class="border-b-2 border-background text-2xl font-semibold tracking-tight text-content-primary"
					style="font-family: 'Pacifico', cursive;"
				>
					{content.lang.header.name}
				</span>
			{:else}
				<span
					class="hidden border-b-2 border-background text-2xl font-semibold tracking-tight text-content-primary sm:inline"
					style="font-family: 'Pacifico', cursive;"
				>
					{content.lang.header.name}
				</span>
			{/if}
		</a>
		<div class="flex-grow"></div>
		{#if !started}
			<Button variant="primary" onclick={onGetStarted}>
				{content.lang.common.getStarted}
			</Button>
		{:else}
			<nav
				class="ms-2 flex flex-row items-center justify-end space-x-3 md:space-x-8"
			>
				<div
					dir={content.lang.dir}
					class="flex h-fit w-fit flex-row items-center justify-start rounded-md bg-card-primary p-1 ps-2 {textStyle}"
				>
					<div class="min-w-3">
						<SearchIcon class="h-3" />
					</div>
					<form class="ms-1" {onsubmit}>
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
							class="w-full max-w-28 border-none bg-transparent font-thin {textStyle} focus:outline-none"
						/>
					</form>
				</div>
				<Nav target="catalog">{content.lang.header.catalog}</Nav>
				<Nav target="plan">{content.lang.header.plan}</Nav>
				<Nav target="progress">
					<Settings></Settings>
				</Nav>
			</nav>
		{/if}
	</div>
</header>
