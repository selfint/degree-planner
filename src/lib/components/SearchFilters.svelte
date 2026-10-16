<script lang="ts">
	import { content } from '$lib/stores.svelte';
	import {
		hasSearchFilters,
		resolveNumericFilterInput,
		snapPointSliderValue,
		stepPointSliderValue,
		type SearchFilters
	} from '$lib/search';

	type Props = {
		filters: SearchFilters;
		faculties: string[];
		maxPoints: number;
		onchange: (filters: Partial<SearchFilters>) => void;
		onclear: () => void;
	};
	const { filters, faculties, maxPoints, onchange, onclear }: Props = $props();
	let pointsMin = $state(0);
	let pointsMax = $state(0);
	let pointsMinText = $state('0.0');
	let pointsMaxText = $state('0.0');
	let medianText = $state('0.0');
	let hasUncommittedInput = $state(false);
	let facultyInput: HTMLSelectElement;
	let fieldset: HTMLFieldSetElement;

	const committedMin = $derived(filters.pointsMin);
	const committedMax = $derived(filters.pointsMax);
	const committedMedian = $derived(filters.medianMin);
	// Unrelated filter updates must not overwrite unfinished number/slider drafts.
	$effect(() => {
		pointsMin = committedMin;
		pointsMinText = committedMin.toFixed(1);
	});
	$effect(() => {
		pointsMax = committedMax;
		pointsMaxText = committedMax.toFixed(1);
	});

	$effect(() => {
		medianText = committedMedian.toFixed(1);
	});

	function clear() {
		// A change and reset can happen before Svelte renders the intermediate value.
		// Reset native controls too, even when their final prop equals the initial prop.
		facultyInput.value = '';
		for (const input of fieldset.querySelectorAll('input')) {
			if (input.type === 'checkbox') input.checked = false;
			else {
				const value = input.id.startsWith('search-points-max') ? maxPoints : 0;
				input.value =
					input.type === 'number' ? value.toFixed(1) : String(value);
			}
		}
		hasUncommittedInput = false;
		pointsMin = 0;
		pointsMax = maxPoints;
		pointsMinText = '0.0';
		pointsMaxText = maxPoints.toFixed(1);
		medianText = '0.0';
		onclear();
	}

	function previewPoints(
		input: HTMLInputElement,
		field: 'pointsMin' | 'pointsMax'
	) {
		hasUncommittedInput = true;
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
		hasUncommittedInput = false;
		const min = field === 'pointsMax' ? pointsMin : 0;
		const max =
			field === 'pointsMin'
				? pointsMax
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
		input.value = value.toFixed(1);
		if (field === 'pointsMin') {
			pointsMin = value;
			pointsMinText = value.toFixed(1);
		}
		if (field === 'pointsMax') {
			pointsMax = value;
			pointsMaxText = value.toFixed(1);
		}
		if (field === 'medianMin') medianText = value.toFixed(1);
		onchange({ [field]: value });
	}

	function commitOnEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			(event.currentTarget as HTMLInputElement).blur();
		}
	}

	function stepNumber(event: KeyboardEvent, field: 'pointsMin' | 'pointsMax') {
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
			commitOnEnter(event);
			return;
		}
		event.preventDefault();
		const input = event.currentTarget as HTMLInputElement;
		const min = field === 'pointsMin' ? 0 : pointsMin;
		const max = field === 'pointsMin' ? pointsMax : maxPoints;
		const current = Number.isFinite(input.valueAsNumber)
			? input.valueAsNumber
			: filters[field];
		const next = stepPointSliderValue(
			current,
			event.key === 'ArrowUp' ? 1 : -1,
			min,
			max
		);
		input.value = next.toFixed(1);
		previewPoints(input, field);
	}

	// step="any" lets the range represent typed tenths; user gestures snap to the half-point grid.
	function previewSlider(
		input: HTMLInputElement,
		field: 'pointsMin' | 'pointsMax'
	) {
		hasUncommittedInput = true;
		const min = field === 'pointsMin' ? 0 : pointsMin;
		const max = field === 'pointsMin' ? pointsMax : maxPoints;
		const value = snapPointSliderValue(input.valueAsNumber, min, max);
		input.value = String(value);
		if (field === 'pointsMin') {
			pointsMin = value;
			pointsMinText = value.toFixed(1);
		} else {
			pointsMax = value;
			pointsMaxText = value.toFixed(1);
		}
	}

	function stepSlider(event: KeyboardEvent, field: 'pointsMin' | 'pointsMax') {
		const input = event.currentTarget as HTMLInputElement;
		const rtl = getComputedStyle(input).direction === 'rtl';
		let direction: 1 | -1;
		if (event.key === 'ArrowUp') direction = 1;
		else if (event.key === 'ArrowDown') direction = -1;
		else if (event.key === 'ArrowRight') direction = rtl ? -1 : 1;
		else if (event.key === 'ArrowLeft') direction = rtl ? 1 : -1;
		else return;
		event.preventDefault();
		const min = field === 'pointsMin' ? 0 : pointsMin;
		const max = field === 'pointsMin' ? pointsMax : maxPoints;
		const current = field === 'pointsMin' ? pointsMin : pointsMax;
		const next = stepPointSliderValue(current, direction, min, max);
		if (next === current) return;
		input.value = String(next);
		previewSlider(input, field);
		updatePoints();
	}

	function updatePoints() {
		hasUncommittedInput = false;
		onchange({ pointsMin, pointsMax });
	}
</script>

<fieldset
	bind:this={fieldset}
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
				onchange={(e) => onchange({ available: e.currentTarget.checked })}
				class="h-4 w-4 cursor-pointer accent-accent-primary"
			/>
			{content.lang.search.available}
		</label>
		<div class="inline-flex max-w-full items-center gap-x-2">
			<label for="search-faculty">{content.lang.search.faculty}</label>
			<select
				id="search-faculty"
				bind:this={facultyInput}
				value={filters.faculty}
				onchange={(e) => onchange({ faculty: e.currentTarget.value })}
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
				value={pointsMin}
				oninput={(e) => previewSlider(e.currentTarget, 'pointsMin')}
				onkeydown={(e) => stepSlider(e, 'pointsMin')}
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
					max={pointsMax}
					step="0.5"
					value={pointsMinText}
					oninput={(e) => previewPoints(e.currentTarget, 'pointsMin')}
					onblur={(e) => commitNumber(e.currentTarget, 'pointsMin')}
					onkeydown={(e) => stepNumber(e, 'pointsMin')}
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
				value={pointsMax}
				oninput={(e) => previewSlider(e.currentTarget, 'pointsMax')}
				onkeydown={(e) => stepSlider(e, 'pointsMax')}
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
					min={pointsMin}
					max={maxPoints}
					step="0.5"
					value={pointsMaxText}
					oninput={(e) => previewPoints(e.currentTarget, 'pointsMax')}
					onblur={(e) => commitNumber(e.currentTarget, 'pointsMax')}
					onkeydown={(e) => stepNumber(e, 'pointsMax')}
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
				value={medianText}
				oninput={() => (hasUncommittedInput = true)}
				inputmode="decimal"
				onblur={(e) => commitNumber(e.currentTarget, 'medianMin')}
				onkeydown={commitOnEnter}
				class="h-8 w-16 rounded-md border border-border bg-background px-1 py-1 text-center text-base text-content-secondary focus-visible:outline-accent-primary"
			/>
		</label>
		<button
			type="button"
			disabled={!hasSearchFilters(filters, maxPoints) && !hasUncommittedInput}
			onclick={clear}
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
