<script lang="ts">
	import { goto } from '$app/navigation';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';

	import { user, degreeData } from '$lib/stores.svelte';

	import { getCourseData } from '$lib/courseData';
	import { getCourseLists, loadDegreeData } from '$lib/requirements';
	import { getScheduleError } from '$lib/schedule';

	const requirements = $derived(degreeData()?.requirements);

	function moveCourseToSemester(code: string, semester: number) {
		user.wishlist = user.wishlist.filter((c) => c !== code);
		user.semesters = user.semesters.map((s, i) =>
			i === semester ? [...new Set([...s, code])] : s.filter((c) => c !== code)
		);
	}

	function moveCourseToWishlist(code: string) {
		user.wishlist = [...new Set([...user.wishlist, code])];
		user.semesters = user.semesters.map((s) => s.filter((c) => c !== code));
	}

	let didMount = false;
	$effect(() => {
		didMount = true;
	});

	function scroll(semester: HTMLDivElement, doScroll: boolean) {
		if (doScroll && !didMount) {
			semester.parentElement?.children[user.currentSemester]?.scrollIntoView({
				behavior: 'instant',
				inline: 'start',
				block: 'nearest'
			});
		}
	}
</script>

<div class="m-3 mr-0">
	<div
		class="mb-4 min-h-[118px]"
		ondragenter={(e) => {
			if (e.dataTransfer?.types.includes('text/x-course')) {
				e.preventDefault();
			}
		}}
		ondragover={(e) => {
			e.preventDefault();
			if (e.dataTransfer !== null) {
				e.dataTransfer.dropEffect = 'move';
			}
		}}
		ondragleave={(e) => e.preventDefault()}
		ondrop={(e) => {
			e.preventDefault();
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
			{#each user.wishlist.map(getCourseData) as course, i}
				<div
					class="container w-fit"
					draggable="true"
					tabindex={i}
					role="button"
					ondragstart={(e) =>
						e.dataTransfer?.setData('text/x-course', course.code)}
					onclick={() => goto(`/course/${course.code}`)}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							goto(`/course/${course.code}`);
						}
					}}
				>
					<CourseElement
						{course}
						lists={getCourseLists(requirements, course.code)}
					/>
				</div>
			{/each}
		</div>
	</div>
	<div style="transform: rotateX(180deg)" class="overflow-x-auto">
		<div style="transform: rotateX(180deg)" class="flex flex-row space-x-3">
			{#key user.semesters.flat().join(' ')}
				{#each user.semesters as semester, semesterIndex}
					<div
						ondragenter={(e) => {
							if (e.dataTransfer?.types.includes('text/x-course')) {
								e.preventDefault();
							}
						}}
						ondragover={(e) => {
							e.preventDefault();
							if (e.dataTransfer !== null) {
								e.dataTransfer.dropEffect = 'move';
							}
						}}
						ondragleave={(e) => e.preventDefault()}
						ondrop={(e) => {
							e.preventDefault();
							const code = e.dataTransfer?.getData('text/x-course');
							if (code !== undefined) {
								moveCourseToSemester(code, semesterIndex);
							}
						}}
						role="button"
						tabindex={semesterIndex}
						use:scroll={semesterIndex === user.semesters.length - 1}
					>
						<Semester
							index={semesterIndex}
							semester={semester.map(getCourseData)}
							isCurrent={semesterIndex === user.currentSemester}
						>
							{#snippet children({ course })}
								<button
									draggable="true"
									class="touch-manipulation text-content-primary"
									ondragstart={(e) => {
										if (e.dataTransfer !== null) {
											e.dataTransfer.setData('text/x-course', course.code);
											e.dataTransfer.effectAllowed = 'move';
										}
									}}
									onclick={() => goto(`/course/${course.code}`)}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											goto(`/course/${course.code}`);
										}
									}}
								>
									<CourseElement
										{course}
										lists={getCourseLists(requirements, course.code)}
										squeeze={true}
										variant={{
											type: 'schedule',
											error: getScheduleError(
												course,
												user.semesters,
												semesterIndex
											)
										}}
									/>
								</button>
							{/snippet}
						</Semester>
					</div>
				{/each}
			{/key}
		</div>
	</div>
</div>
