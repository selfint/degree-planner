<script lang="ts">
	import { goto } from '$app/navigation';
	import Logo from '$lib/assets/logo.png';

	import { courses, groups, years, wishlist } from '$lib/stores';
	import { get, writable } from 'svelte/store';
	import Year from './Year.svelte';
	import { selectedSemester } from './stores';
	import Wishlist from './Wishlist.svelte';
	import Catalog from './Catalog.svelte';
	import YearInput from './YearInput.svelte';

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

	function onWishlistClick(code: string, toYears: boolean): void {
		if (toYears) {
			if ($selectedSemester !== undefined) {
				const [y, s] = $selectedSemester;
				const yearStore = $years[y];
				const year = get(yearStore);
				const semester = [year.winter, year.spring, year.summer][s];
				semester.push(code);

				yearStore.set({
					...year,
					winter: [...new Set(year.winter)],
					spring: [...new Set(year.spring)],
					summer: [...new Set(year.summer)]
				});
				$years = $years;

				$wishlist = $wishlist.filter((w) => w !== code);
			}
		} else {
			$wishlist = $wishlist.filter((w) => w !== code);
		}
	}

	function deleteYear(i: number): void {
		$years = $years.filter((_, index) => index !== i);
	}

	function newYear(name: string): boolean {
		if ($years.some((year) => get(year).name === name)) {
			return false;
		}

		$years = [...$years, writable({ name, winter: [], summer: [], spring: [] })];
		return true;
	}

	function onCourseDelete(code: string): void {
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

		{#each $years as year, i}
			<Year
				{year}
				index={i}
				onDelete={() => deleteYear(i)}
				{onCourseDelete}
				expandCourse={getFullCourse}
			/>
		{/each}

		<div class="mt-2 w-full rounded-md border-2 border-dark-400 bg-dark-700 p-2">
			<YearInput onNewYear={newYear} />
		</div>
	</div>
	<div class="p-2">
		<Wishlist wishlist={$wishlist.map(getFullCourse)} {onWishlistClick} />
	</div>
	<div class="p-2">
		<Catalog courses={catalogCourses} onClick={addToWishlist} />
	</div>
</div>
