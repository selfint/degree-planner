<script lang="ts">
	import SearchFilters from '$lib/components/SearchFilters.svelte';
	import type { SearchFilters as Filters } from '$lib/search';
	let {
		selected = false,
		empty = false,
		unknownFaculty = false,
		expanded = false
	} = $props();
	const defaults: Filters = {
		available: false,
		faculty: '',
		pointsMin: 0,
		pointsMax: 6,
		medianMin: 0
	};
	let filters = $state<Filters>({ ...defaults });
	$effect(() => {
		filters = selected
			? {
					available: true,
					faculty: unknownFaculty ? 'Archived faculty' : 'Example science',
					pointsMin: 2,
					pointsMax: 4,
					medianMin: 80
				}
			: { ...defaults };
	});
</script>

<SearchFilters
	{expanded}
	{filters}
	faculties={empty ? [] : ['Example science', 'Example engineering']}
	maxPoints={6}
	onchange={(patch) => (filters = { ...filters, ...patch })}
	onclear={() => (filters = { ...defaults })}
/>
<output class="mt-3 block text-sm text-content-secondary"
	>{JSON.stringify(filters)}</output
>
