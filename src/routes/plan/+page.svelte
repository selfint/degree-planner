<script lang="ts">
	import { goto } from '$app/navigation';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import Button from '$lib/components/Button.svelte';

	import { user, content } from '$lib/stores.svelte';

	import { getCourseData } from '$lib/courseData';
	import { getScheduleError } from '$lib/schedule';

	let wishlist = $state(user.wishlist);
	let semesters = $state(user.semesters);
	let hasChanges = $derived(
		wishlist !== user.wishlist || semesters !== user.semesters
	);

	const shareLink = $derived.by(() => {
		if (user.degree === undefined) {
			return undefined;
		}

		const [year, faculty, degree] = user.degree;

		const semesters = user.semesters.map((s) => s.join('-')).join('~');

		const urlParams = new URLSearchParams();
		if (user.path !== undefined) {
			urlParams.append('path', user.path);
		}
		urlParams.append('semesters', semesters);

		const link = `/preview/${year}/${faculty}/${degree}?${urlParams}`;

		return link;
	});

	function onSave() {
		user.wishlist = wishlist;
		user.semesters = semesters;
	}

	function onCancel() {
		wishlist = user.wishlist;
		semesters = user.semesters;
	}

	function moveCourseToSemester(code: string, semester: number) {
		wishlist = wishlist.filter((c) => c !== code);
		semesters = semesters.map((s, i) =>
			i === semester ? [...new Set([...s, code])] : s.filter((c) => c !== code)
		);
	}

	function moveCourseToWishlist(code: string) {
		wishlist = [...new Set([...wishlist, code])];
		semesters = semesters.map((s) => s.filter((c) => c !== code));
	}

	let didMount = false;
	$effect(() => {
		didMount = true;
	});

	function scroll(semester: HTMLDivElement, index: number) {
		const doScroll =
			!didMount && user.currentSemester > 2 && index === semesters.length - 1;

		if (doScroll) {
			semester.parentElement?.children[user.currentSemester]?.scrollIntoView({
				behavior: 'instant',
				inline: 'start',
				block: 'nearest'
			});
		}
	}
</script>

<div class="mb-3 mt-3">
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
		<div class="mb-1 me-3 ms-3 flex flex-row justify-between">
			<h1 class="text-base font-medium text-content-primary">
				{content.lang.plan.wishlist}
			</h1>
			<div class="flex flex-row items-center gap-x-2 text-sm">
				{#if hasChanges}
					<Button variant="secondary" onclick={onCancel}>
						{content.lang.settings.cancel}
					</Button>
					<Button variant="primary" onclick={onSave}>
						{content.lang.settings.save}
					</Button>
				{/if}
				{#if user.semesters.some((s) => s.length > 0)}
					<a href={shareLink} target="_blank">
						<Button variant="primary" onclick={() => {}}>
							{content.lang.settings.share}
						</Button>
					</a>
				{/if}
			</div>
		</div>
		<CourseRow courses={wishlist}>
			{#snippet children({ course, index: i })}
				<div
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
					<CourseElement {course} />
				</div>
			{/snippet}
		</CourseRow>
	</div>
	<div style="transform: rotateX(180deg)" class="overflow-x-auto">
		<div style="transform: rotateX(180deg)" class="flex flex-row">
			<div class="ms-3"></div>
			{#key semesters.flat().join(' ')}
				{#each semesters as semester, semesterIndex}
					<div
						draggable="false"
						class="pe-2"
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
							const code = e.dataTransfer?.getData('text/x-course') ?? '';
							if (code !== '') {
								moveCourseToSemester(code, semesterIndex);
							}
						}}
						role="button"
						tabindex={semesterIndex}
						use:scroll={semesterIndex}
					>
						<Semester
							index={semesterIndex}
							semester={semester.map(getCourseData)}
							isCurrent={semesterIndex === user.currentSemester}
							href={`/semester?c=${semesterIndex}`}
						>
							{#snippet children({ course, index })}
								<div
									draggable="true"
									class="touch-manipulation text-content-primary"
									ondragstart={(e) => {
										if (e.dataTransfer !== null) {
											e.dataTransfer.setData('text/x-course', course.code);
											e.dataTransfer.effectAllowed = 'move';
										}
									}}
									role="button"
									tabindex={index}
									onclick={() => goto(`/course/${course.code}`)}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											goto(`/course/${course.code}`);
										}
									}}
								>
									<CourseElement
										{course}
										squeeze={true}
										scheduleError={getScheduleError(
											course,
											semesters,
											semesterIndex
										)}
									/>
								</div>
							{/snippet}
						</Semester>
					</div>
				{/each}
			{/key}
			<div class="min-w-[1px]"></div>
		</div>
	</div>
</div>
