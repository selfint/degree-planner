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
		expanded?: boolean;
		filters: SearchFilters;
		faculties: string[];
		maxPoints: number;
		onchange: (filters: Partial<SearchFilters>) => void;
		onclear: () => void;
	};
	let {
		filters,
		faculties,
		maxPoints,
		onchange,
		onclear,
		expanded = $bindable(false)
	}: Props = $props();
	let pointsMin = $state(0);
	let pointsMax = $state(0);
	let pointsMinText = $state('0.0');
	let pointsMaxText = $state('0.0');
	let medianText = $state('0.0');
	let hasUncommittedInput = $state(false);
	let facultyInput: HTMLSelectElement;
	let fieldset: HTMLFieldSetElement;
	const activeCount = $derived(
		Number(filters.available) +
			Number(Boolean(filters.faculty)) +
			Number(filters.pointsMin > 0) +
			Number(filters.pointsMax < maxPoints) +
			Number(filters.medianMin > 0)
	);

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

	function beginSliderGesture(event: PointerEvent) {
		// Keep the release even if the pointer leaves the narrow slider track.
		(event.currentTarget as HTMLInputElement).setPointerCapture(
			event.pointerId
		);
	}

	function updatePoints() {
		hasUncommittedInput = false;
		onchange({ pointsMin, pointsMax });
	}
</script>

<details class="search-filters ui-panel" bind:open={expanded}>
	<summary class="filter-summary">
		<span>{content.lang.search.filters}</span>
		{#if activeCount > 0}
			<span
				class="filter-count"
				aria-label={content.lang.lang === 'he'
					? `${activeCount} מסננים פעילים`
					: `${activeCount} active filters`}>{activeCount}</span
			>
		{/if}
	</summary>
	<fieldset bind:this={fieldset} class="min-w-0 text-sm text-content-primary">
		<legend class="sr-only">{content.lang.search.filters}</legend>
		<div class="filter-grid">
			<label class="filter-available">
				<input
					type="checkbox"
					checked={filters.available}
					onchange={(e) => onchange({ available: e.currentTarget.checked })}
					class="h-5 w-5 shrink-0 cursor-pointer accent-accent-primary"
				/>
				{content.lang.search.available}
			</label>
			<div class="filter-field">
				<label for="search-faculty">{content.lang.search.faculty}</label>
				<select
					id="search-faculty"
					bind:this={facultyInput}
					value={filters.faculty}
					onchange={(e) => onchange({ faculty: e.currentTarget.value })}
					class="ui-field w-full"
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
			<div class="filter-range">
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
					onpointerdown={beginSliderGesture}
					onpointerup={updatePoints}
					onpointercancel={updatePoints}
					ontouchend={updatePoints}
					ontouchcancel={updatePoints}
					onkeyup={updatePoints}
					onchange={updatePoints}
					class="range-input"
				/>
				<label for="search-points-min-input" class="number-field">
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
						class="ui-field w-full text-center tabular-nums"
					/>
				</label>
			</div>
			<div class="filter-range">
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
					onpointerdown={beginSliderGesture}
					onpointerup={updatePoints}
					onpointercancel={updatePoints}
					ontouchend={updatePoints}
					ontouchcancel={updatePoints}
					onkeyup={updatePoints}
					onchange={updatePoints}
					class="range-input"
				/>
				<label for="search-points-max-input" class="number-field">
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
						class="ui-field w-full text-center tabular-nums"
					/>
				</label>
			</div>
			<label class="filter-field">
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
					class="ui-field w-full text-center tabular-nums"
				/>
			</label>
			<button
				type="button"
				disabled={!hasSearchFilters(filters, maxPoints) && !hasUncommittedInput}
				onclick={clear}
				class="ui-button ui-button--secondary filter-clear"
			>
				{content.lang.search.clearFilters}
			</button>
		</div>
	</fieldset>
</details>

<style>
	.search-filters {
		margin-block-end: 1.5rem;
		padding: 0.25rem 1rem 1rem;
	}
	.search-filters:not([open]) {
		padding-block-end: 0.25rem;
	}
	.filter-summary {
		min-block-size: 2.75rem;
		padding-block: 0.625rem;
		cursor: pointer;
		font-weight: 600;
	}
	.filter-summary:focus-visible {
		outline: 0.125rem solid rgb(var(--color-accent-primary));
		outline-offset: 0.1875rem;
		border-radius: 0.375rem;
	}
	.filter-summary::marker {
		color: rgb(var(--color-content-secondary));
	}
	.filter-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-inline-size: 1.5rem;
		padding-inline: 0.375rem;
		margin-inline-start: 0.5rem;
		border-radius: 1rem;
		background: rgb(var(--color-accent-primary) / 0.15);
		color: rgb(var(--color-content-primary));
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}
	.filter-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
		gap: 1rem 1.5rem;
		padding-block-start: 0.5rem;
	}
	.filter-field {
		display: grid;
		align-content: start;
		gap: 0.375rem;
		min-inline-size: 0;
	}
	.filter-available {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-block-size: 2.75rem;
		cursor: pointer;
		align-self: end;
	}
	.filter-range {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 4.5rem;
		align-items: center;
		gap: 0.375rem 0.75rem;
		min-inline-size: 0;
	}
	.filter-range > label:first-child {
		grid-column: 1 / -1;
	}
	.range-input {
		inline-size: 100%;
		min-inline-size: 0;
		block-size: 2.75rem;
		cursor: pointer;
		accent-color: rgb(var(--color-accent-primary));
	}
	.number-field {
		min-inline-size: 0;
		cursor: text;
	}
	.filter-clear {
		align-self: end;
	}

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
