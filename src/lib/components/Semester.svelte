<script lang="ts">
	import type { Writable } from 'svelte/store';
	import CourseList from './CourseList.svelte';

	export let index: number;
	export let courses: Course[];
	export let prevCourses: Course[];
	export let semester: Writable<Course[]>;
	export let onRemove: () => void;

	$: availableCourses = courses
		.filter((course) => course.info?.connections !== undefined)
		.filter((course) => !$semester.some((c) => c.code === course.code))
		.filter((course) => !prevCourses.some((c) => c.code === course.code))
		.filter((course) => {
			const courseDependencies = course.info?.connections?.dependencies.some((deps) =>
				deps.every((dep) => prevCourses.some((prevCourse) => prevCourse.code === dep))
			);
			const courseAdjacencies = course.info?.connections?.adjacent.every(
				(dep) =>
					prevCourses.some((prevCourse) => prevCourse.code === dep) ||
					$semester.some((prevCourse) => prevCourse.code === dep)
			);

			if (course.code === '104032') {
				console.log(course, courseDependencies, courseAdjacencies);
			}

			return courseDependencies && courseAdjacencies;
		});

	function addCourse(course: Course) {
		$semester = [...$semester, course].filter(
			(course, index, self) => index === self.findIndex((t) => t.code === course.code)
		);
	}

	function removeCourse(course: Course) {
		$semester = $semester.filter((c) => c.code !== course.code);
	}
</script>

<div>
	<h2 class="text-2xl">
		Semester {index + 1}

		<button class="border border-black bg-red-500 px-1 py-0" on:mousedown={onRemove}> X </button>
	</h2>
	<h3 class="text-xl">
		Registered Courses ({$semester.reduce((acc, course) => acc + (course.info?.points ?? 0), 0)} points)
	</h3>
	<CourseList courses={$semester} onClick={removeCourse} />
	<h3 class="text-xl">Available Courses</h3>
	<CourseList courses={availableCourses} onClick={addCourse} />
</div>
