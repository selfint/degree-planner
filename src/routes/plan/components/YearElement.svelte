<script lang="ts">
	import type { Writable } from 'svelte/store';

	import { selectedSemester } from '../stores';
	import Semester from './Semester.svelte';

	export let year: Writable<Year>;
	export let yearIndex: number;
	export let onDelete: () => void;
	export let onCourseDelete: (code: string, semester: [number, number]) => void;
	export let expandCourse: (code: string) => Course;

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

	function removeCourse(code: string, semester: number): void {
		$year = {
			...$year,
			winter: $year.winter.filter((c) => c !== code),
			spring: $year.spring.filter((c) => c !== code),
			summer: $year.summer.filter((c) => c !== code)
		};

		onCourseDelete(code, [yearIndex, semester]);
	}
</script>

<div class="mb-2 w-full rounded-md border-2 border-dark-400 bg-dark-700">
	<div class="grid grid-cols-3">
		<div class="col-span-1">
			<h3 class="p-2 text-xl text-white">{$year.name}</h3>
		</div>
		<div class="col-span-1" />
		<div class="col-span-1 mb-1 text-right">
			<button
				on:mousedown={onDelete}
				class="m-2 border-2 border-dark-400 bg-teal-800 p-1 text-white"
			>
				X
			</button>
		</div>
		<div
			class="col-span-1 border-b-2 border-dark-400 {selectionEquals($selectedSemester, yearIndex, 0)
				? 'bg-teal-800'
				: 'bg-opacity-50'}"
			role="button"
			tabindex={yearIndex}
			on:mousedown={() => updateSelection(yearIndex, 0)}
		>
			<Semester
				name="Winter"
				courses={$year.winter.map(expandCourse)}
				onCourseClick={(code) => removeCourse(code, 0)}
			/>
		</div>
		<div
			class="col-span-1 border-l-2 border-r-2 border-dark-400 {selectionEquals(
				$selectedSemester,
				yearIndex,
				1
			)
				? 'bg-teal-800'
				: 'bg-opacity-50'}"
			role="button"
			tabindex={yearIndex}
			on:mousedown={() => updateSelection(yearIndex, 1)}
		>
			<Semester
				name="Spring"
				courses={$year.spring.map(expandCourse)}
				onCourseClick={(code) => removeCourse(code, 1)}
			/>
		</div>
		<div
			class="col-span-1 border-dark-400 {selectionEquals($selectedSemester, yearIndex, 2)
				? 'bg-teal-800'
				: 'bg-opacity-50'}"
			role="button"
			tabindex={yearIndex}
			on:mousedown={() => updateSelection(yearIndex, 2)}
		>
			<Semester
				name="Summer"
				courses={$year.summer.map(expandCourse)}
				onCourseClick={(code) => removeCourse(code, 2)}
			/>
		</div>
	</div>
</div>
