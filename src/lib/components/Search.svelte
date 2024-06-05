<script lang="ts">
	import SearchIcon from '$lib/components/SearchIcon.svelte';

	export let onSearch: (query: string) => void;

	let query = '';
	let placeholder = 'Search';

	$: selected = false;
	$: textStyle = selected ? 'text-content-primary' : 'text-content-secondary';
</script>

<div
	class="flex h-fit w-fit min-w-64 flex-row items-center justify-start space-x-2 rounded-md bg-card-primary pb-1 pl-3 pr-3 pt-1 {textStyle}"
>
	<SearchIcon class="h-3 w-fit" />
	<form on:submit|preventDefault={() => onSearch(query)}>
		<input
			type="text"
			{placeholder}
			on:focus={() => {
				selected = true;
				placeholder = '';
			}}
			on:blur={() => {
				selected = false;
				placeholder = 'Search';
			}}
			bind:value={query}
			class="flex-grow border-none bg-transparent font-thin {textStyle} focus:outline-none"
		/>
	</form>
</div>
