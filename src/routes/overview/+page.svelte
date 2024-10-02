<script lang="ts">
	import { goto } from '$app/navigation';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';

	import {
		semesters,
		degreeData,
		currentSemester,
		wishlist
	} from '$lib/stores';

	import { getCourseData } from '$lib/courseData';
	import { getCourseLists } from '$lib/requirements';
	import { getScheduleError } from '$lib/schedule';

	function moveCourseToSemester(code: string, semester: number) {
		$wishlist = $wishlist.filter((c) => c !== code);
		$semesters = $semesters.map((s, i) =>
			i === semester ? [...new Set([...s, code])] : s.filter((c) => c !== code)
		);
	}

	function moveCourseToWishlist(code: string) {
		$wishlist = [...new Set([...$wishlist, code])];
		$semesters = $semesters.map((s) => s.filter((c) => c !== code));
	}
</script>

<div class="m-3 mr-0">
	<div
		class="mb-4 min-h-[118px]"
		on:dragenter={(e) => {
			if (e.dataTransfer?.types.includes('text/x-course')) {
				e.preventDefault();
			}
		}}
		on:dragover|preventDefault={(e) => {
			if (e.dataTransfer !== null) {
				e.dataTransfer.dropEffect = 'move';
			}
		}}
		on:dragleave|preventDefault
		on:drop|preventDefault={(e) => {
			const code = e.dataTransfer?.getData('text/x-course');
			if (code !== undefined) {
				moveCourseToWishlist(code);
			}
		}}
		role="button"
		tabindex={0}
	>
		<h1 class="mb-2 text-lg font-medium text-content-primary">Wish list</h1>
		<div class="flex flex-row space-x-2 overflow-x-auto">
			{#each $wishlist.map(getCourseData) as course, i}
				<div
					class="container w-fit"
					draggable="true"
					tabindex={i}
					role="button"
					on:dragstart={(e) =>
						e.dataTransfer?.setData('text/x-course', course.code)}
					on:click={() => goto(`/course/${course.code}`)}
					on:keydown={(e) => {
						if (e.key === 'Enter') {
							goto(`/course/${course.code}`);
						}
					}}
				>
					<CourseElement
						{course}
						lists={$degreeData?.then((d) =>
							getCourseLists(d.requirements, course.code)
						)}
					/>
				</div>
			{/each}
		</div>
	</div>
	<div style="transform: rotateX(180deg)" class="overflow-x-auto">
		<div style="transform: rotateX(180deg)" class="flex flex-row space-x-3">
			{#key $semesters.flat().join(' ')}
				{#each $semesters as semester, semesterIndex}
					<div
						on:dragenter={(e) => {
							if (e.dataTransfer?.types.includes('text/x-course')) {
								e.preventDefault();
							}
						}}
						on:dragover|preventDefault={(e) => {
							if (e.dataTransfer !== null) {
								e.dataTransfer.dropEffect = 'move';
							}
						}}
						on:dragleave|preventDefault
						on:drop|preventDefault={(e) => {
							const code = e.dataTransfer?.getData('text/x-course');
							if (code !== undefined) {
								moveCourseToSemester(code, semesterIndex);
							}
						}}
						role="button"
						tabindex={semesterIndex}
					>
						<Semester
							index={semesterIndex}
							semester={semester.map(getCourseData)}
							isCurrent={semesterIndex === $currentSemester}
						>
							<div
								slot="course"
								let:course
								let:index={j}
								draggable="true"
								tabindex={j}
								role="button"
								class="text-content-primary"
								on:dragstart={(e) => {
									if (e.dataTransfer !== null) {
										e.dataTransfer.setData('text/x-course', course.code);
										e.dataTransfer.effectAllowed = 'move';
									}
								}}
								on:click={() => goto(`/course/${course.code}`)}
								on:keydown={(e) => {
									if (e.key === 'Enter') {
										goto(`/course/${course.code}`);
									}
								}}
							>
								<CourseElement
									{course}
									lists={$degreeData?.then((d) =>
										getCourseLists(d.requirements, course.code)
									)}
									variant={{
										type: 'schedule',
										error: getScheduleError(course, $semesters, semesterIndex)
									}}
								/>
							</div>
						</Semester>
					</div>
				{/each}
			{/key}
		</div>
	</div>
</div>
