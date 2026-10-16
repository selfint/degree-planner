<script lang="ts">
	import { content } from '$lib/stores.svelte';
	import { hasSearchFilters, type SearchFilters } from '$lib/search';

	type Props = {
		filters: SearchFilters;
		faculties: string[];
		maxPoints: number;
		pending: boolean;
		onchange: (filters: SearchFilters) => void;
		onclear: () => void;
	};
	const { filters, faculties, maxPoints, pending, onchange, onclear }: Props =
		$props();
	let pointsMin = $state(0);
	let pointsMax = $state(0);

	$effect(() => {
		pointsMin = filters.pointsMin;
		pointsMax = filters.pointsMax;
	});

	function updatePoints() {
		onchange({ ...filters, pointsMin, pointsMax });
	}
</script>

<fieldset disabled={pending} class="mb-3 text-base text-content-secondary">
	<legend class="mb-2 text-lg text-content-primary"
		>{content.lang.search.filters}</legend
	>
	<div class="flex flex-wrap items-center gap-x-4 gap-y-3">
		<label class="inline-flex cursor-pointer items-center gap-x-2">
			<input
				type="checkbox"
				checked={filters.available}
				onchange={(e) =>
					onchange({ ...filters, available: e.currentTarget.checked })}
				class="h-4 w-4 cursor-pointer accent-accent-primary"
			/>
			{content.lang.search.available}
		</label>
		<div class="inline-flex max-w-full items-center gap-x-2">
			<label for="search-faculty">{content.lang.search.faculty}</label>
			<select
				id="search-faculty"
				value={filters.faculty}
				onchange={(e) =>
					onchange({ ...filters, faculty: e.currentTarget.value })}
				class="min-w-0 max-w-full rounded-md border border-border bg-background p-1 text-content-secondary focus-visible:outline-accent-primary"
			>
				<option value="">{content.lang.search.allFaculties}</option>
				{#if filters.faculty && !faculties.includes(filters.faculty)}
					<option value={filters.faculty}>{filters.faculty}</option>
				{/if}
				{#each faculties as faculty}
					<option value={faculty}>{faculty}</option>
				{/each}
			</select>
		</div>
		<div class="inline-flex items-center gap-x-2">
			<label for="search-points-min">{content.lang.search.minPoints}</label>
			<input
				id="search-points-min"
				type="range"
				min="0"
				max={pointsMax}
				step="0.5"
				bind:value={pointsMin}
				onchange={updatePoints}
				class="h-2 w-24 cursor-pointer accent-accent-primary"
			/>
			<output for="search-points-min" class="min-w-8">{pointsMin}</output>
		</div>
		<div class="inline-flex items-center gap-x-2">
			<label for="search-points-max">{content.lang.search.maxPoints}</label>
			<input
				id="search-points-max"
				type="range"
				min={pointsMin}
				max={maxPoints}
				step="0.5"
				bind:value={pointsMax}
				onchange={updatePoints}
				class="h-2 w-24 cursor-pointer accent-accent-primary"
			/>
			<output for="search-points-max" class="min-w-8">{pointsMax}</output>
		</div>
		<label class="inline-flex items-center gap-x-2">
			<span>{content.lang.search.minMedian}</span>
			<input
				type="number"
				min="0"
				max="100"
				step="any"
				value={filters.medianMin}
				onchange={(e) => {
					const input = e.currentTarget;
					const medianMin = input.value === '' ? 0 : input.valueAsNumber;
					if (Number.isFinite(medianMin)) {
						const clamped = Math.max(0, Math.min(100, medianMin));
						input.value = String(clamped);
						onchange({ ...filters, medianMin: clamped });
					}
				}}
				class="w-20 rounded-md border border-border bg-background p-1 text-content-secondary focus-visible:outline-accent-primary"
			/>
		</label>
		<button
			type="button"
			disabled={!hasSearchFilters(filters, maxPoints)}
			onclick={onclear}
			class="rounded-md border border-border px-2 py-1 text-content-primary hover:bg-card-primary disabled:cursor-default disabled:opacity-40"
		>
			{content.lang.search.clearFilters}
		</button>
	</div>
</fieldset>
