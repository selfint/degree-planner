<script lang="ts">
	import SearchIcon from '$lib/components/SearchIcon.svelte';

	type Props = {
		onsubmit: (query: string) => void;
	};

	const { onsubmit }: Props = $props();

	let query = $state('');
	let placeholder = $state('Search');

	let selected = $state(false);
	const textStyle = $derived(
		selected ? 'text-content-primary' : 'text-content-secondary'
	);
</script>

<div
	class="flex h-fit w-fit min-w-40 flex-row items-center justify-start rounded-md bg-card-primary pb-1 pl-2 pr-1 pt-1 {textStyle}"
>
	<SearchIcon class="h-3" />
	<form class="ml-1 w-24" onsubmit={() => onsubmit(query)}>
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
			class="w-full flex-grow border-none bg-transparent font-thin {textStyle} focus:outline-none"
		/>
	</form>
</div>
