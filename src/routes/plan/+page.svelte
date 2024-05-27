<script lang="ts">
	import { goto } from '$app/navigation';
	import { get, writable } from 'svelte/store';

	import Logo from '$lib/assets/logo.png';

	import { courses, groups, years, wishlist } from '$lib/stores';
	import { selectedSemester } from './stores';

	import Year from './components/YearElement.svelte';
	import Wishlist from './components/Wishlist.svelte';
	import Catalog from './components/Catalog.svelte';
	import YearInput from './components/YearInput.svelte';
	import Requirements from './components/Requirements.svelte';

	$: fullCourses = new Map($courses.map((course) => [course.code, course]));
	function getFullCourse(code: string): Course {
		return fullCourses.get(code) as Course;
	}

	$: plannedCourses = $years.map(get).flatMap((y) => y.winter.concat(y.spring).concat(y.summer));

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

	function addCourseToSemester(code: string, yearIndex: number, semesterIndex: number): void {
		const yearStore = $years[yearIndex];
		const year = get(yearStore);
		const semester = [year.winter, year.spring, year.summer][semesterIndex];
		semester.push(code);

		yearStore.set({
			...year,
			winter: [...new Set(year.winter)],
			spring: [...new Set(year.spring)],
			summer: [...new Set(year.summer)]
		});
		$years = $years;
	}

	function onWishlistClick(code: string, toYears: boolean): void {
		if (toYears) {
			if ($selectedSemester !== undefined) {
				const [y, s] = $selectedSemester;
				addCourseToSemester(code, y, s);

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

	function onCourseDelete(code: string, selection: [number, number]): void {
		console.log(
			[code, selection],
			$selectedSemester !== undefined &&
				!($selectedSemester[0] === selection[0] && $selectedSemester[1] === selection[1])
		);
		if (
			$selectedSemester !== undefined &&
			!($selectedSemester[0] === selection[0] && $selectedSemester[1] === selection[1])
		) {
			const [y, s] = $selectedSemester;
			addCourseToSemester(code, y, s);
		} else {
			$wishlist = [...$wishlist, code];
		}
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
		<Requirements groups={$groups.map(get)} years={$years.map(get)} />
	</div>
	<div class="flex-grow p-2">
		<h2 class="text-xl text-white">Years</h2>

		{#each $years as year, i}
			<Year
				{year}
				yearIndex={i}
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
