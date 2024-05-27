<script lang="ts">
	import { goto } from '$app/navigation';
	import Logo from '$lib/assets/logo.png';

	import { courses, groups, years, wishlist } from '$lib/stores';
	import { get, writable } from 'svelte/store';

	$: fullCourses = new Map($courses.map((course) => [course.code, course]));
	function getFullCourse(code: string): Course {
		return fullCourses.get(code) as Course;
	}

	$: wishlistCourses = $wishlist.map(getFullCourse).filter((c) => c !== undefined);
	$: plannedCourses = $years.map(get).flatMap((y) => y.winter.concat(y.spring).concat(y.summer));
	$: yearCourses = $years.map(get).map((year) => {
		return {
			...year,
			winter: year.winter.map(getFullCourse).filter((c) => c?.info !== undefined),
			spring: year.spring.map(getFullCourse).filter((c) => c?.info !== undefined),
			summer: year.summer.map(getFullCourse).filter((c) => c?.info !== undefined)
		};
	});
	$: groupPoints = $groups.map(get).map((group) =>
		plannedCourses
			.filter((code) => group.courses.some((c) => c.code === code))
			.map(getFullCourse)
			.map((c) => c.info?.points ?? 0)
			.reduce((a, b) => a + b, 0)
	);

	let catalogCourses: Course[] = [];

	$: {
		const wish = $wishlist;
		const c = $courses;

		catalogCourses = c
			.filter((course) => !wish.some((w) => course.code === w))
			.filter((course) => !plannedCourses.some((p) => course.code === p));
	}

	function addToWishlist(course: Course): void {
		$wishlist = [...new Set([...$wishlist, course.code])];
	}

	function onWishlistClick(course: Course): void {
		if (toYears) {
			if (selectedSemester !== undefined) {
				const [y, s] = selectedSemester;
				const yearStore = $years[y];
				const year = get(yearStore);
				const semester = [year.winter, year.spring, year.summer][s];
				semester.push(course.code);

				yearStore.set({
					...year,
					winter: [...new Set(year.winter)],
					spring: [...new Set(year.spring)],
					summer: [...new Set(year.summer)]
				});
				$years = $years;

				$wishlist = $wishlist.filter((w) => w !== course.code);
			}
		} else {
			$wishlist = $wishlist.filter((w) => w !== course.code);
		}
	}

	let newYearName: string | undefined = undefined;

	let toYears = true;

	function deleteYear(i: number): void {
		$years = $years.filter((_, index) => index !== i);
	}

	function newYear() {
		if (newYearName === undefined) {
			return;
		}

		if ($years.some((year) => get(year).name === newYearName)) {
			return;
		}

		$years = [...$years, writable({ name: newYearName, winter: [], summer: [], spring: [] })];
		newYearName = undefined;
	}

	let selectedSemester: [number, number] | undefined = undefined;
	function selectionEquals(
		selection: [number, number] | undefined,
		year: number,
		semester: number
	): boolean {
		return !(selection === undefined || selection[0] !== year || selection[1] !== semester);
	}

	function updateSelection(year: number, semester: number): void {
		if (selectionEquals(selectedSemester, year, semester)) {
			selectedSemester = undefined;
		} else {
			selectedSemester = [year, semester];
		}
	}

	function removeCourse(yearIndex: number, semesterIndex: number, code: string): void {
		const yearStore = $years[yearIndex];
		const year = get(yearStore);

		yearStore.set({
			...year,
			winter: year.winter.filter((c) => c !== code),
			spring: year.spring.filter((c) => c !== code),
			summer: year.summer.filter((c) => c !== code)
		});
		$years = $years;

		$wishlist = [...$wishlist, code];
	}
</script>

<div class="flex flex-row items-center space-x-2 border-b-2 border-dark-400 p-1">
	<img src={Logo} alt="Logo" class="h-12" />
	<h1 class="text-4xl text-white">Degree plan</h1>
	<div class="flex-grow"></div>
	<button
		on:mousedown={() => goto('/')}
		class="h-12 border-2 border-dark-400 bg-teal-800 p-2 text-white"
	>
		Catalog
	</button>
</div>

<div class="flex flex-row flex-wrap">
	<div class="p-2">
		<h2 class="text-xl text-white">Requirements</h2>
		{#each $groups as group, i}
			<div class="mb-2 flex flex-row items-center border-2 border-dark-400 bg-dark-700 p-2">
				<h3 class="text-xl text-white">{get(group).name}</h3>
				<div class="min-w-2 flex-grow" />
				<p class="text-white">
					{groupPoints[i]} / {get(group).points}
				</p>
			</div>
		{/each}
	</div>
	<div class="flex-grow p-2">
		<h2 class="text-xl text-white">Years</h2>

		{#each yearCourses as year, i}
			<div class="mb-2 w-full rounded-md border-2 border-dark-400 bg-dark-700">
				<div class="grid grid-cols-3">
					<div class="col-span-1">
						<h3 class="p-2 text-xl text-white">{year.name}</h3>
					</div>
					<div class="col-span-1" />
					<div class="col-span-1 mb-1 text-right">
						<button
							on:mousedown={() => deleteYear(i)}
							class="m-2 border-2 border-dark-400 bg-teal-800 p-1 text-white"
						>
							X
						</button>
					</div>
					<div
						class="col-span-1 border-b-2 border-dark-400 {selectionEquals(selectedSemester, i, 0)
							? 'bg-teal-800'
							: 'bg-opacity-50'}"
						role="button"
						tabindex={i}
						on:mousedown={() => updateSelection(i, 0)}
					>
						<h2 class="border-b-2 border-dark-400 pl-2 text-lg text-white">Winter</h2>
						{#each year.winter as course, j}
							<div
								on:mousedown|preventDefault|stopPropagation={() => removeCourse(i, 0, course.code)}
								role="button"
								tabindex={j}
								class="{j % 2 === 0 ? 'bg-dark-500' : 'bg-dark-700'} p-1"
							>
								<p class="text-sm text-white">{course.info?.name}</p>
							</div>
						{/each}
					</div>
					<div
						class="col-span-1 border-l-2 border-r-2 border-dark-400 {selectionEquals(
							selectedSemester,
							i,
							1
						)
							? 'bg-teal-800'
							: 'bg-opacity-50'}"
						role="button"
						tabindex={i}
						on:mousedown={() => updateSelection(i, 1)}
					>
						<h2 class="border-b-2 border-dark-400 pl-2 text-lg text-white">Spring</h2>
						{#each year.spring as course, j}
							<div
								on:mousedown|preventDefault|stopPropagation={() => removeCourse(i, 1, course.code)}
								role="button"
								tabindex={j}
								class="{j % 2 === 0 ? 'bg-dark-500' : 'bg-dark-700'} p-1"
							>
								<p class="text-sm text-white">{course.info?.name}</p>
							</div>
						{/each}
					</div>
					<div
						class="col-span-1 border-dark-400 {selectionEquals(selectedSemester, i, 2)
							? 'bg-teal-800'
							: 'bg-opacity-50'}"
						role="button"
						tabindex={i}
						on:mousedown={() => updateSelection(i, 2)}
					>
						<h2 class="border-b-2 border-dark-400 pl-2 text-lg text-white">Summer</h2>
						{#each year.summer as course, j}
							<div
								on:mousedown|preventDefault|stopPropagation={() => removeCourse(i, 2, course.code)}
								role="button"
								tabindex={j}
								class="{j % 2 === 0 ? 'bg-dark-500' : 'bg-dark-700'} p-1"
							>
								<p class="text-sm text-white">{course.info?.name}</p>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/each}

		<div class="mt-2 w-full rounded-md border-2 border-dark-400 bg-dark-700 p-2">
			<form on:submit|preventDefault={newYear}>
				<div class="flex flex-row items-center">
					<div class="flex w-fit flex-row">
						<label for="group-name" class="text-white">Name:</label>
						<div class="min-w-1 flex-grow" />
						<input
							type="text"
							id="group-name"
							bind:value={newYearName}
							class="rounded-md border-2 border-dark-400 bg-dark-50 pl-1 text-white focus:bg-teal-700 focus:outline-none"
						/>
					</div>
					<div class="flex-grow"></div>
					<button
						class="bg-teal h-12 w-fit border-2 border-dark-400 bg-teal-800 p-2 text-white"
						type="submit"
					>
						Add
					</button>
				</div>
			</form>
		</div>
	</div>
	<div class="p-2">
		<div class="flex flex-row items-center">
			{#if !toYears}
				<h2 class="text-xl text-white">Wishlist</h2>
				<div class="min-w-1 flex-grow"></div>
			{/if}
			<button
				class="h-7 border-2 border-dark-400 bg-teal-800 pb-1 pl-1 pr-1 text-white"
				on:mousedown|preventDefault={() => (toYears = !toYears)}
			>
				{toYears ? '<--' : '-->'}
			</button>
			{#if toYears}
				<div class="min-w-1 flex-grow"></div>
				<h2 class="text-xl text-white">Wishlist</h2>
			{/if}
		</div>
		{#each wishlistCourses as course, i}
			{#if course.info !== undefined}
				<div
					class="{i % 2 === 0 ? 'bg-dark-500' : 'bg-dark-700'} p-1 text-sm"
					role="button"
					tabindex={i}
					on:mousedown={() => onWishlistClick(course)}
				>
					<p class="text-white">{course.info.name}</p>
				</div>
			{/if}
		{/each}
	</div>
	<div class="p-2">
		<h2 class="text-xl text-white">Catalog</h2>
		{#each catalogCourses as course, i}
			{#if course.info !== undefined}
				<div
					class="{i % 2 === 0 ? 'bg-dark-500' : 'bg-dark-700'} p-1 text-sm"
					role="button"
					tabindex={i}
					on:mousedown={() => addToWishlist(course)}
				>
					<p class="text-white">{course.info?.name}</p>
				</div>
			{/if}
		{/each}
	</div>
</div>
