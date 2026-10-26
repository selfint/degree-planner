<script lang="ts">
	import Logo from '$lib/assets/logo.webp?enhanced';
	import Title from '$lib/assets/Title.svg?raw';

	import SearchIcon from '$lib/components/SearchIcon.svelte';

	import Nav from './Nav.svelte';

	import { content } from '$lib/preferences.svelte';
	import Settings from '$lib/components/Settings.svelte';
	import GetStartedLink from '$lib/components/GetStartedLink.svelte';
	import { browserLink } from '$lib/browserLinks';

	type Props = {
		started: boolean;
		searchQuery: string;
		searchRevision: number;
		onSearch: (query: string) => void;
	};

	const { started, searchQuery, searchRevision, onSearch }: Props = $props();

	let query = $state('');
	const committedQuery = $derived(searchQuery);
	$effect(() => {
		// A filter-only navigation must not overwrite an unfinished query draft.
		// History/external navigation does discard drafts, even when q is unchanged.
		searchRevision;
		query = committedQuery;
	});
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

<header dir="ltr" class="title-bar" class:console={started}>
	<a
		href="/"
		use:browserLink
		data-sveltekit-reload
		target="_blank"
		rel="external noopener noreferrer"
		class="brand"
		aria-label="PlanIt"
	>
		<enhanced:img src={Logo} loading="eager" alt="" class="brand-logo" />
		<span class="brand-title">{@html Title}</span>
	</a>
	{#if !started}
		<GetStartedLink />
	{:else}
		<form class="header-search" dir={content.lang.dir} role="search" {onsubmit}>
			<span class="search-icon" aria-hidden="true"><SearchIcon /></span>
			<input
				type="text"
				aria-label={content.lang.header.searchPlaceholder}
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
				class={textStyle}
			/>
		</form>
		<nav
			aria-label={content.lang.lang === 'he' ? 'ניווט ראשי' : 'Main navigation'}
		>
			<Nav target="catalog">{content.lang.header.catalog}</Nav>
			<Nav target="plan">{content.lang.header.plan}</Nav>
			<Nav target="settings">
				<span aria-hidden="true"><Settings /></span>
				<span class="sr-only">{content.lang.landing.settings.header}</span>
			</Nav>
		</nav>
	{/if}
</header>

<style>
	.title-bar {
		display: flex;
		inline-size: 100%;
		max-inline-size: 80rem;
		min-block-size: 4.5rem;
		margin-inline: auto;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem clamp(1rem, 3vw, 2rem);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		direction: ltr;
	}
	.brand :global(.brand-logo) {
		inline-size: 2.8875rem;
		block-size: 2.8875rem;
		object-fit: contain;
	}
	.brand-title {
		inline-size: 5.5rem;
		color: rgb(var(--color-content-primary));
	}
	.brand-title :global(svg) {
		inline-size: 100%;
		block-size: auto;
	}
	.console {
		--titlebar-font-size: 0.875rem;
		min-block-size: 3rem;
		padding: 0.25rem 0.5rem;
		gap: 0.5rem;
		display: grid;
		grid-template-columns: auto minmax(0, 25rem) auto;
	}
	.console .brand :global(.brand-logo) {
		inline-size: 2.1rem;
		block-size: 2.1rem;
	}
	.console .brand-title {
		inline-size: 4rem;
	}
	nav {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: end;
		gap: 0.25rem;
	}
	.header-search {
		display: flex;
		min-inline-size: 0;
		min-block-size: 2.25rem;
		align-items: center;
		gap: 0.375rem;
		padding-inline: 0.5rem;
		border: 0.0625rem solid rgb(var(--color-border));
		border-radius: 0.375rem;
		background: rgb(var(--color-card-primary));
	}
	.header-search:focus-within {
		border-color: rgb(var(--color-accent-primary));
		box-shadow: 0 0 0 0.1875rem rgb(var(--color-accent-primary) / 0.1);
	}
	.search-icon {
		display: grid;
		place-items: center;
		inline-size: 1rem;
		block-size: 1rem;
		flex-shrink: 0;
		line-height: 1;
		color: rgb(var(--color-content-secondary));
	}
	.search-icon :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: 100%;
	}
	input {
		inline-size: 100%;
		min-inline-size: 0;
		padding-block: 0.25rem;
		border: 0;
		outline: none;
		background: transparent;
		font-size: var(--titlebar-font-size);
		line-height: 1.5;
	}
	input::placeholder {
		color: rgb(var(--color-content-secondary));
	}
	@media (any-pointer: coarse) {
		input {
			/* iOS zooms focused inputs below 16px, including installed PWAs.
			   Keep pinch zoom available and preserve the compact header geometry. */
			font-size: max(16px, 1rem);
		}
	}
	@media (max-width: 39.99rem) {
		.console {
			/* Reserve the global 2px outline plus 3px focus offset. */
			padding-inline: 0.3125rem;
			gap: 0.25rem;
		}
		nav {
			gap: 0.125rem;
		}
		.console .brand :global(.brand-logo) {
			inline-size: 1.8375rem;
			block-size: 1.8375rem;
		}
		.console .brand-title {
			display: none;
		}
		.header-search {
			gap: 0.25rem;
			padding-inline: 0.25rem;
		}
		.search-icon {
			inline-size: 0.875rem;
			block-size: 0.875rem;
		}
	}
</style>
