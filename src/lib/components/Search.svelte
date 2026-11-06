<script lang="ts">
	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import { content } from '$lib/preferences.svelte';
	type Props = { onsubmit: (query: string) => void };
	let { onsubmit: submit }: Props = $props();
	let query = $state('');
</script>

<form
	class="search-field"
	role="search"
	onsubmit={(event) => {
		event.preventDefault();
		submit(query);
	}}
>
	<input
		type="text"
		aria-label={content.lang.header.searchPlaceholder}
		placeholder={content.lang.header.searchPlaceholder}
		bind:value={query}
		class="min-w-0 flex-1 bg-transparent text-base text-content-primary placeholder:text-content-secondary focus:outline-none"
	/>
	<button
		type="submit"
		aria-label={content.lang.header.searchPlaceholder}
		class="search-submit"
	>
		<SearchIcon class="h-5 w-5" />
	</button>
</form>

<style>
	.search-field {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		inline-size: min(100%, 24rem);
		min-block-size: 2.75rem;
		padding-inline-start: 0.875rem;
		border: 0.0625rem solid rgb(var(--color-border));
		border-radius: 0.75rem;
		background: rgb(var(--color-card-primary));
	}
	.search-field:focus-within {
		border-color: rgb(var(--color-accent-primary));
		box-shadow: 0 0 0 0.1875rem rgb(var(--color-accent-primary) / 0.12);
	}
	.search-submit {
		display: grid;
		place-items: center;
		min-inline-size: 2.75rem;
		min-block-size: 2.75rem;
		border-radius: 0.625rem;
		color: rgb(var(--color-content-secondary));
	}
	.search-submit:hover {
		background: rgb(var(--color-card-secondary));
		color: rgb(var(--color-content-primary));
	}
</style>
