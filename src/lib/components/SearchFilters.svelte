<script lang="ts">
	import { content } from '$lib/stores.svelte';
	import {
		hasSearchFilters,
		resolveNumericFilterInput,
		type SearchFilters
	} from '$lib/search';

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
	let pointsMinText = $state('0');
	let pointsMaxText = $state('0');

	$effect(() => {
		pointsMin = filters.pointsMin;
		pointsMax = filters.pointsMax;
		pointsMinText = String(filters.pointsMin);
		pointsMaxText = String(filters.pointsMax);
	});

	function previewPoints(
		input: HTMLInputElement,
		field: 'pointsMin' | 'pointsMax'
	) {
		if (
			input.value === '' ||
			input.validity.badInput ||
			!Number.isFinite(input.valueAsNumber)
		)
			return;
		if (field === 'pointsMin')
			pointsMin = Math.max(0, Math.min(pointsMax, input.valueAsNumber));
		else
			pointsMax = Math.max(pointsMin, Math.min(maxPoints, input.valueAsNumber));
	}

	function commitNumber(
		input: HTMLInputElement,
		field: 'pointsMin' | 'pointsMax' | 'medianMin'
	) {
		const min = field === 'pointsMax' ? filters.pointsMin : 0;
		const max =
			field === 'pointsMin'
				? filters.pointsMax
				: field === 'pointsMax'
					? maxPoints
					: 100;
		const empty = field === 'pointsMax' ? maxPoints : 0;
		const value = resolveNumericFilterInput(
			input.value,
			min,
			max,
			empty,
			filters[field],
			input.validity.badInput
		);
		input.value = String(value);
		if (field === 'pointsMin') {
			pointsMin = value;
			pointsMinText = String(value);
		}
		if (field === 'pointsMax') {
			pointsMax = value;
			pointsMaxText = String(value);
		}
		onchange({ ...filters, [field]: value });
	}

	function commitOnEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			(event.currentTarget as HTMLInputElement).blur();
		}
	}

	function updatePoints() {
		onchange({ ...filters, pointsMin, pointsMax });
	}
</script>

<fieldset
	disabled={pending}
	class="mb-3 min-w-0 text-base text-content-secondary"
>
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
		<div class="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
			<label id="search-points-min-label" for="search-points-min-input"
				>{content.lang.search.minPoints}</label
			>
			<input
				id="search-points-min"
				aria-labelledby="search-points-min-label"
				type="range"
				min="0"
				max={pointsMax}
				step="any"
				bind:value={pointsMin}
				oninput={(e) => (pointsMinText = e.currentTarget.value)}
				onchange={updatePoints}
				class="h-2 w-24 cursor-pointer accent-accent-primary"
			/>
			<label
				for="search-points-min-input"
				class="inline-flex min-h-11 cursor-text items-center"
			>
				<input
					id="search-points-min-input"
					type="number"
					inputmode="decimal"
					min="0"
					max={filters.pointsMax}
					step="any"
					value={pointsMinText}
					oninput={(e) => previewPoints(e.currentTarget, 'pointsMin')}
					onblur={(e) => commitNumber(e.currentTarget, 'pointsMin')}
					onkeydown={commitOnEnter}
					class="h-8 w-16 rounded-md border border-border bg-background px-1 py-1 text-center text-base text-content-secondary focus-visible:outline-accent-primary"
				/>
			</label>
		</div>
		<div class="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
			<label id="search-points-max-label" for="search-points-max-input"
				>{content.lang.search.maxPoints}</label
			>
			<input
				id="search-points-max"
				aria-labelledby="search-points-max-label"
				type="range"
				min={pointsMin}
				max={maxPoints}
				step="any"
				bind:value={pointsMax}
				oninput={(e) => (pointsMaxText = e.currentTarget.value)}
				onchange={updatePoints}
				class="h-2 w-24 cursor-pointer accent-accent-primary"
			/>
			<label
				for="search-points-max-input"
				class="inline-flex min-h-11 cursor-text items-center"
			>
				<input
					id="search-points-max-input"
					type="number"
					inputmode="decimal"
					min={filters.pointsMin}
					max={maxPoints}
					step="any"
					value={pointsMaxText}
					oninput={(e) => previewPoints(e.currentTarget, 'pointsMax')}
					onblur={(e) => commitNumber(e.currentTarget, 'pointsMax')}
					onkeydown={commitOnEnter}
					class="h-8 w-16 rounded-md border border-border bg-background px-1 py-1 text-center text-base text-content-secondary focus-visible:outline-accent-primary"
				/>
			</label>
		</div>
		<label class="inline-flex min-h-11 cursor-text items-center gap-x-2">
			<span>{content.lang.search.minMedian}</span>
			<input
				type="number"
				min="0"
				max="100"
				step="any"
				value={filters.medianMin}
				inputmode="decimal"
				onblur={(e) => commitNumber(e.currentTarget, 'medianMin')}
				onkeydown={commitOnEnter}
				class="h-8 w-16 rounded-md border border-border bg-background px-1 py-1 text-center text-base text-content-secondary focus-visible:outline-accent-primary"
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

<style>
	/* Keep decimal values readable in compact fields without desktop spin buttons. */
	input[type='number'] {
		appearance: textfield;
	}

	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
</style>
