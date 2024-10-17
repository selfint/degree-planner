<script lang="ts">
	import SearchIcon from '$lib/components/SearchIcon.svelte';

	type Props = {
		onsubmit: (query: string) => void;
	};

	let { onsubmit: _onsubmit }: Props = $props();

	const onsubmit = (e: Event) => {
		e.preventDefault();
		_onsubmit(query);
	};

	let query = $state('');
	let placeholder = $state('Search');

	let selected = $state(false);
	const textStyle = $derived(
		selected ? 'text-content-primary' : 'text-content-secondary'
	);
</script>

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
