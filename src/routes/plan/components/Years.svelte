<script lang="ts">
	import type { Writable } from 'svelte/store';

	import { selectedSemester } from '../stores';
	import Semester from './Semester.svelte';

	export let years: Writable<Year[]>;
	export let expandCourse: (code: string) => Course;
	export let onCourseDelete: (code: string) => void;

	$: previousCourses = $years.map(
		(_year, index) =>
			$years.slice(0, index).flatMap((y) => y.winter.concat(y.spring).concat(y.summer)) ?? []
	);

	function selectionEquals(
		selection: [number, number] | undefined,
		year: number,
		semester: number
	): boolean {
		return !(selection === undefined || selection[0] !== year || selection[1] !== semester);
	}

	function updateSelection(year: number, semester: number): void {
		if (selectionEquals($selectedSemester, year, semester)) {
			$selectedSemester = undefined;
		} else {
			$selectedSemester = [year, semester];
		}
	}

	function addCourse(
		years: Year[],
		code: string,
		yearIndex: number,
		semesterIndex: number
	): Year[] {
		const year = years[yearIndex];
		const semester = [year.winter, year.spring, year.summer][semesterIndex];
		semester.push(code);

		years[yearIndex] = {
			...year,
			winter: [...new Set(year.winter)],
			spring: [...new Set(year.spring)],
			summer: [...new Set(year.summer)]
		};

		return years;
	}

	function removeCourse(
		years: Year[],
		code: string,
		yearIndex: number,
		semesterIndex: number,
		selection: [number, number] | undefined
	): Year[] {
		const year = years[yearIndex];
		const semester = [year.winter, year.spring, year.summer][semesterIndex];
		semester.push(code);

		years[yearIndex] = {
			...year,
			winter: year.winter.filter((c) => c !== code),
			spring: year.spring.filter((c) => c !== code),
			summer: year.summer.filter((c) => c !== code)
		};

		if (
			selection !== undefined &&
			!(selection[0] === yearIndex && selection[1] === semesterIndex)
		) {
			const [y, s] = selection;
			addCourse(years, code, y, s);
		} else {
			onCourseDelete(code);
		}

		return years;
	}
</script>

{#each $years as year, i}
	<div class="mb-2 w-full rounded-md border-2 border-dark-400 bg-dark-700">
		<div class="grid grid-cols-3">
			<div class="col-span-1">
				<h3 class="p-2 text-xl text-white">{year.name}</h3>
			</div>
			<div class="col-span-1" />
			<div class="col-span-1 mb-1 text-right">
				<button
					on:mousedown={() => ($years = $years.filter((_, j) => i !== j))}
					class="m-2 border-2 border-dark-400 bg-teal-800 p-1 text-white"
				>
					X
				</button>
			</div>
			<div
				class="col-span-1 border-b-2 border-dark-400 {selectionEquals($selectedSemester, i, 0)
					? 'bg-teal-800'
					: 'bg-opacity-50'}"
				role="button"
				tabindex={i}
				on:mousedown={() => updateSelection(i, 0)}
			>
				<Semester
					name="Winter"
					courses={year.winter.map(expandCourse)}
					onCourseClick={(code) => ($years = removeCourse($years, code, i, 0, $selectedSemester))}
					previousCourses={previousCourses[i]}
				/>
			</div>
			<div
				class="col-span-1 border-l-2 border-r-2 border-dark-400 {selectionEquals(
					$selectedSemester,
					i,
					1
				)
					? 'bg-teal-800'
					: 'bg-opacity-50'}"
				role="button"
				tabindex={i}
				on:mousedown={() => updateSelection(i, 1)}
			>
				<Semester
					name="Winter"
					courses={year.spring.map(expandCourse)}
					onCourseClick={(code) => ($years = removeCourse($years, code, i, 1, $selectedSemester))}
					previousCourses={previousCourses[i].concat(year.winter)}
				/>
			</div>
			<div
				class="col-span-1 border-dark-400 {selectionEquals($selectedSemester, i, 2)
					? 'bg-teal-800'
					: 'bg-opacity-50'}"
				role="button"
				tabindex={i}
				on:mousedown={() => updateSelection(i, 2)}
			>
				<Semester
					name="Winter"
					courses={year.summer.map(expandCourse)}
					onCourseClick={(code) => ($years = removeCourse($years, code, i, 2, $selectedSemester))}
					previousCourses={previousCourses[i].concat(year.winter).concat(year.spring)}
				/>
			</div>
		</div>
	</div>
{/each}
