<script lang="ts">
	import { goto } from '$app/navigation';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import Button from '$lib/components/Button.svelte';

	import { user, content, writeStorage, setUser } from '$lib/stores.svelte';

	import { getCourseData } from '$lib/courseData';
	import { getScheduleError } from '$lib/schedule';
	import AsyncButton from '$lib/components/AsyncButton.svelte';

	let wishlist = $state(user.d.wishlist);
	let semesters = $state(user.d.semesters);
	const hasChanges = $derived(
		wishlist !== user.d.wishlist || semesters !== user.d.semesters
	);

	$effect(() => {
		wishlist = user.d.wishlist;
		semesters = user.d.semesters;
	});

	const shareLink = $derived.by(() => {
		if (user.d.degree === undefined) {
			return undefined;
		}

		const [year, faculty, degree] = user.d.degree;

		const semesters = user.d.semesters.map((s) => s.join('-')).join('~');

		const urlParams = new URLSearchParams();
		if (user.d.path !== undefined) {
			urlParams.append('path', user.d.path);
		}
		urlParams.append('semesters', semesters);

		const link = `/preview/${year}/${faculty}/${degree}?${urlParams}`;

		return link;
	});

	function onCancel() {
		wishlist = user.d.wishlist;
		semesters = user.d.semesters;
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
			!didMount && user.d.currentSemester > 2 && index === semesters.length - 1;

		if (doScroll) {
			semester.parentElement?.children[user.d.currentSemester]?.scrollIntoView({
				behavior: 'instant',
				inline: 'start',
				block: 'nearest'
			});
		}
	}

	let canCancel = $state(true);
	async function onSave() {
		canCancel = false;
		try {
			setUser(await writeStorage({ ...user.d, wishlist, semesters }));
		} catch (_) {
			canCancel = true;
		}
	}
</script>

<div class="mb-3 mt-3">
	<div class="mb-4 min-h-[118px]">
		<div class="mb-1 me-3 ms-3 flex flex-row justify-between">
			<h1 class="text-base font-medium text-content-primary">
				{content.lang.plan.wishlist}
			</h1>
			<div class="flex flex-row items-center gap-x-2 text-sm">
				{#if hasChanges}
					{#if canCancel}
						<Button variant="secondary" onclick={onCancel}>
							{content.lang.settings.cancel}
						</Button>
					{/if}
					<AsyncButton variant="primary" onclick={onSave}>
						{content.lang.settings.save}
					</AsyncButton>
				{/if}
				{#if user.d.semesters.some((s) => s.length > 0)}
					<a href={shareLink} target="_blank">
						<Button variant="primary" onclick={() => {}}>
							{content.lang.settings.share}
						</Button>
					</a>
				{/if}
			</div>
		</div>
		<CourseRow
			courses={wishlist}
			sortable={{
				group: 'semesters',
				dataIdAttr: 'data-code',
				onAdd: (event) => {
					const data = event.item.getAttribute('data-code');

					if (data !== null) {
						event.item.remove();
						moveCourseToWishlist(data);
					}
				}
			}}
		>
			{#snippet children({ course })}
				<button onclick={() => goto(`/course/${course.code}`)}>
					<CourseElement {course} />
				</button>
			{/snippet}
		</CourseRow>
	</div>
	<div style="transform: rotateX(180deg)" class="overflow-x-auto">
		<div style="transform: rotateX(180deg)" class="flex flex-row">
			<div class="ms-3"></div>
			{#key semesters.flat().join(' ')}
				{#each semesters as semester, semesterIndex}
					<div class="pe-2" use:scroll={semesterIndex}>
						<Semester
							index={semesterIndex}
							semester={semester.map(getCourseData)}
							isCurrent={semesterIndex === user.d.currentSemester}
							href={`/semester?c=${semesterIndex}`}
							sortable={{
								group: 'semesters',
								dataIdAttr: 'data-code',
								sort: false,
								ghostClass: 'sortable-ghost',
								onAdd: (event) => {
									const data = event.item.getAttribute('data-code');

									if (data !== null) {
										event.item.remove();
										moveCourseToSemester(data, semesterIndex);
									}
								}
							}}
						>
							{#snippet children({ course })}
								<button
									class="touch-manipulation text-content-primary"
									data-code={course.code}
									onclick={() => goto(`/course/${course.code}`)}
								>
									<CourseElement
										{course}
										squeeze={true}
										scheduleError={getScheduleError(
											course,
											user.d.exemptions,
											semesters,
											semesterIndex
										)}
									/>
								</button>
							{/snippet}
						</Semester>
					</div>
				{/each}
			{/key}
			<div class="min-w-[1px]"></div>
		</div>
	</div>
</div>

<style>
	:global(.sortable-ghost) {
		visibility: hidden;
		max-height: 0px;
		max-width: 0px;
		overflow: hidden;
	}
</style>
