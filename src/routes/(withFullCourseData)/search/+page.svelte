<script lang="ts">
	import { page, navigating } from '$app/state';
	import { goto } from '$app/navigation';

	import { content, user } from '$lib/stores.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Select from '$lib/components/Select.svelte';

	const { data: pageData } = $props();
	const { fullCourseData } = $derived(pageData);

	const query = $derived.by(() => {
		let q = (page.url.searchParams.get('q') ?? '').trim();

		// special case for backwards compatibility, convert 6 digit codes to 8 digit codes
		// first, check if q is all numbers
		const allNumbers = /^\d+$/.test(q);
		const isSixDigit = q.length === 6;
		if (allNumbers && isSixDigit) {
			const p1 = q.slice(0, 3);
			const p2 = q.slice(3);

			return `0${p1}0${p2}`;
		}

		return q;
	});

	function toNumber(value: string | null): number | undefined {
		if (value === null || value.trim() === '') {
			return undefined;
		}
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.min(Math.max(value, min), max);
	}

	const filters = $derived.by(() => {
		const available = page.url.searchParams.get('available') !== null;
		const facultyParam = page.url.searchParams.get('faculty')?.trim();
		const pointsMin = toNumber(page.url.searchParams.get('pointsMin'));
		const pointsMax = toNumber(page.url.searchParams.get('pointsMax'));
		const medianMin = toNumber(page.url.searchParams.get('medianMin'));

		return {
			available,
			faculty: facultyParam === '' ? undefined : facultyParam,
			pointsMin,
			pointsMax,
			medianMin
		};
	});

	function match(c: FullCourse, query: string): boolean {
		return (
			c.code.includes(query) ||
			(c.name?.includes(query) ?? false) ||
			(c.about?.includes(query) ?? false)
		);
	}

	async function getResults(
		query: string,
		fullCourseData: Promise<FullCourse[]>
	) {
		const d = await fullCourseData;

		return d
			.filter((course) => match(course, query))
			.toSorted((a, b) => {
				return (b.median ?? 0) - (a.median ?? 0);
			});
	}

	const results = $derived(getResults(query, fullCourseData));
	const faculties = $derived.by(async () => {
		const data = await fullCourseData;
		const values = data
			.map((course) => course.faculty)
			.filter(
				(faculty): faculty is string =>
					faculty !== undefined && faculty.trim() !== ''
			);
		return Array.from(new Set(values)).toSorted((a, b) => a.localeCompare(b));
	});

	const maxPoints = $derived.by(async () => {
		const data = await fullCourseData;
		const values = data
			.map((course) => course.points)
			.filter(
				(points): points is number =>
					points !== undefined && Number.isFinite(points)
			);
		const max = values.length === 0 ? 0 : Math.max(...values);
		return Math.ceil(max * 2) / 2;
	});

	function resolveFilters(
		raw: {
			available: boolean;
			faculty?: string;
			pointsMin?: number;
			pointsMax?: number;
			medianMin?: number;
		},
		maxPoints: number
	) {
		let pointsMin = raw.pointsMin ?? 0;
		let pointsMax = raw.pointsMax ?? maxPoints;

		pointsMin = clamp(pointsMin, 0, maxPoints);
		pointsMax = clamp(pointsMax, 0, maxPoints);
		if (pointsMin > pointsMax) {
			[pointsMin, pointsMax] = [pointsMax, pointsMin];
		}

		let medianMin = raw.medianMin;
		if (medianMin !== undefined) {
			medianMin = clamp(medianMin, 0, 100);
		}

		return {
			available: raw.available,
			faculty: raw.faculty,
			pointsMin,
			pointsMax,
			pointsActive: pointsMin > 0 || pointsMax < maxPoints,
			medianMin
		};
	}

	function matchesFilters(
		course: FullCourse,
		filters: {
			available: boolean;
			faculty?: string;
			pointsMin: number;
			pointsMax: number;
			pointsActive: boolean;
			medianMin?: number;
		}
	): boolean {
		if (filters.available && !course.current) {
			return false;
		}
		if (filters.faculty !== undefined && course.faculty !== filters.faculty) {
			return false;
		}
		if (filters.pointsActive) {
			if (course.points === undefined) {
				return false;
			}
			if (course.points < filters.pointsMin) {
				return false;
			}
			if (course.points > filters.pointsMax) {
				return false;
			}
		}
		if (filters.medianMin !== undefined) {
			if (course.median === undefined) {
				return false;
			}
			if (course.median < filters.medianMin) {
				return false;
			}
		}
		return true;
	}

	function updateSearchParams(update: (params: URLSearchParams) => void) {
		const params = new URLSearchParams(page.url.searchParams);
		update(params);
		goto(`?${params.toString()}`, {
			replaceState: false,
			noScroll: true
		});
	}

	function updateFaculty(value: string | undefined) {
		updateSearchParams((params) => {
			if (value === undefined || value === '') {
				params.delete('faculty');
			} else {
				params.set('faculty', value);
			}
		});
	}

	function updatePointsMin(
		value: number,
		pointsMax: number,
		maxPoints: number
	) {
		const nextMin = clamp(value, 0, maxPoints);
		const nextMax = clamp(pointsMax, 0, maxPoints);
		updateSearchParams((params) => {
			const minValue = Math.min(nextMin, nextMax);
			if (minValue <= 0) {
				params.delete('pointsMin');
			} else {
				params.set('pointsMin', minValue.toString());
			}
			if (nextMax >= maxPoints) {
				params.delete('pointsMax');
			}
		});
	}

	function updatePointsMax(
		value: number,
		pointsMin: number,
		maxPoints: number
	) {
		const nextMax = clamp(value, 0, maxPoints);
		const nextMin = clamp(pointsMin, 0, maxPoints);
		updateSearchParams((params) => {
			const maxValue = Math.max(nextMin, nextMax);
			if (nextMin <= 0) {
				params.delete('pointsMin');
			} else {
				params.set('pointsMin', nextMin.toString());
			}
			if (maxValue >= maxPoints) {
				params.delete('pointsMax');
			} else {
				params.set('pointsMax', maxValue.toString());
			}
		});
	}

	function updateMedianMin(value: string) {
		const parsed = value.trim() === '' ? undefined : Number(value);
		if (parsed !== undefined && !Number.isFinite(parsed)) {
			return;
		}
		updateSearchParams((params) => {
			if (parsed === undefined) {
				params.delete('medianMin');
				return;
			}
			const clamped = clamp(parsed, 0, 100);
			if (clamped <= 0) {
				params.delete('medianMin');
			} else {
				params.set('medianMin', clamped.toString());
			}
		});
	}

	function getCourseSemester(course: Course): number | undefined {
		const index = user.d.semesters.findIndex((s) => s.includes(course.code));

		if (index === -1) {
			return undefined;
		} else {
			return index;
		}
	}

	const seasonEmojis = ['❄️', '🌿', '☀️'];

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}
</script>

<div class="m-3 me-0 text-content-primary">
	<h1 class="text-lg">
		{content.lang.search.filters}
	</h1>
	<ul
		class="mb-3 flex flex-row flex-wrap items-baseline gap-x-3 gap-y-2 text-base text-content-secondary"
	>
		<li class="inline-flex cursor-pointer items-center gap-x-1">
			<label for="available-checkbox" class="cursor-pointer">
				{content.lang.search.available}
			</label>
			<input
				id="available-checkbox"
				type="checkbox"
				disabled={navigating === null}
				onchange={() => {
					const params = new URLSearchParams(page.url.searchParams);

					if (filters.available) {
						params.delete('available');
					} else {
						params.set('available', '');
					}

					goto(`?${params.toString()}`, {
						replaceState: false,
						noScroll: true
					});
				}}
				checked={filters.available}
				class="h-4 w-4 cursor-pointer border-none bg-card-secondary accent-accent-primary"
			/>
		</li>
		<li class="inline-flex items-center gap-x-1">
			<span>{content.lang.search.faculty}</span>
			{#await faculties}
				<div class="h-5 w-5">
					<Spinner />
				</div>
			{:then faculties}
				<Select
					value={filters.faculty ?? ''}
					onchange={(value) => updateFaculty(value)}
				>
					<option value="">{content.lang.search.allFaculties}</option>
					{#each faculties as faculty}
						<option value={faculty}>{faculty}</option>
					{/each}
				</Select>
			{/await}
		</li>
		<li class="inline-flex items-center gap-x-1">
			<span class="text-content-secondary">
				{content.lang.search.minPoints}
			</span>

			{#await maxPoints}
				<div class="h-5 w-5">
					<Spinner />
				</div>
			{:then maxPoints}
				{@const resolved = resolveFilters(filters, maxPoints)}
				<input
					type="range"
					min="0"
					max={maxPoints}
					step="0.5"
					value={resolved.pointsMin}
					class="h-2 w-28 cursor-pointer accent-accent-primary"
					oninput={(e) =>
						updatePointsMin(
							Number(e.currentTarget.value),
							resolved.pointsMax,
							maxPoints
						)}
				/>
				<span class="min-w-8 text-right">
					{resolved.pointsMin}
				</span>
			{/await}
		</li>
		<li class="inline-flex items-center gap-x-1">
			<span class="text-content-secondary">
				{content.lang.search.maxPoints}
			</span>
			{#await maxPoints}
				<div class="h-5 w-5">
					<Spinner />
				</div>
			{:then maxPoints}
				{@const resolved = resolveFilters(filters, maxPoints)}
				<input
					type="range"
					min="0"
					max={maxPoints}
					step="0.5"
					value={resolved.pointsMax}
					class="h-2 w-28 cursor-pointer accent-accent-primary"
					oninput={(e) =>
						updatePointsMax(
							Number(e.currentTarget.value),
							resolved.pointsMin,
							maxPoints
						)}
				/>
				<span class="min-w-8 text-right">
					{resolved.pointsMax}
				</span>
			{/await}
		</li>
		<li class="inline-flex items-center gap-x-1">
			<span>{content.lang.search.median}</span>
			<input
				type="number"
				min="0"
				max="100"
				value={filters.medianMin ?? '0'}
				class="w-fit rounded-md border border-border bg-background p-1 text-content-secondary outline-none"
				onchange={(e) => updateMedianMin(e.currentTarget.value)}
			/>
		</li>
	</ul>
	<h1 class="text-lg">
		{content.lang.search.resultsFor} "{query}"
	</h1>
	<span class="mb-3 text-base text-content-secondary">
		{#await Promise.all([results, maxPoints])}
			<div class="inline-block h-5 w-5">
				<Spinner />
			</div>
			{content.lang.common.loading}
		{:then [results, maxPoints]}
			{@const resolved = resolveFilters(filters, maxPoints)}
			{@const filteredResults = results.filter((course) =>
				matchesFilters(course, resolved)
			)}
			{results.length}
			{#if filteredResults.length === results.length}
				{content.lang.search.resultsFound}
			{:else}
				{content.lang.search.resultsFound},
				{content.lang.search.displaying}
				{filteredResults.length}
			{/if}
		{/await}
	</span>

	<ul class="flex flex-row flex-wrap">
		{#await Promise.all([results, maxPoints]) then [results, maxPoints]}
			{@const resolved = resolveFilters(filters, maxPoints)}
			{@const filteredResults = results.filter((course) =>
				matchesFilters(course, resolved)
			)}
			{#each filteredResults as course (course.code)}
				<li id={course.code} class="pb-4 pe-2">
					<button
						class:opacity-60={!course.current}
						onclick={() => goto(`/course/${course.code}`)}
					>
						<CourseElement code={course.code} {course}>
							{#snippet note()}
								{@const index = getCourseSemester(course)}
								{#if index !== undefined}
									<span>
										{seasonEmojis[index % 3]}
										<span class="hidden sm:inline">
											{content.lang.common.seasons[index % 3]}
											{Math.floor(index / 3) + 1}
										</span>
									</span>
								{:else if user.d.exemptions.includes(course.code)}
									<span>✓</span>
									<span class="hidden sm:inline">
										{content.lang.catalog.exempt}
									</span>
								{:else if user.d.wishlist.includes(course.code)}
									<span>🌟</span>
									<span class="hidden sm:inline">
										{formatName(content.lang.catalog.wishlist)}
									</span>
								{/if}
							{/snippet}
						</CourseElement>
					</button>
				</li>
			{/each}
		{/await}
	</ul>
</div>
