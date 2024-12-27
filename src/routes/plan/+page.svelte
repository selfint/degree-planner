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

	async function onCancel() {
		wishlist = user.d.wishlist;
		semesters = user.d.semesters;
	}

	function moveCourseToWishlist(code: string) {
		wishlist = [...new Set([...wishlist, code])];
		semesters = semesters.map((s) => s.filter((c) => c !== code));
	}

	let buttonNamespace = $state('');
	async function onSave() {
		setUser(await writeStorage({ ...user.d, wishlist, semesters }));
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
					<AsyncButton
						variant="secondary"
						onclick={onCancel}
						bind:buttonNamespace
						name="cancel"
					>
						{content.lang.settings.cancel}
					</AsyncButton>
					<AsyncButton
						variant="primary"
						onclick={onSave}
						bind:buttonNamespace
						name="save"
					>
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
				sort: false,
				dataIdAttr: 'data-code',
				onAdd: (event) => {
					const data = event.item.getAttribute('data-code');

					if (data !== null) {
						moveCourseToWishlist(data);
						if (wishlist.includes(data)) {
							event.item.remove();
						}
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
			{#key semesters.map((s) => s.join('-')).join(',')}
				{#each semesters as semester, semesterIndex}
					<div class="pe-2">
						<Semester
							index={semesterIndex}
							semester={semester.map(getCourseData)}
							isCurrent={semesterIndex === user.d.currentSemester}
							href={`/semester?c=${semesterIndex}`}
							sortable={{
								group: 'semesters',
								dataIdAttr: 'data-code',
								sort: true,
								onUpdate: (event) => {
									const code = event.item.getAttribute('data-code');
									if (code === null) {
										return;
									}

									const semesterCodes = Array.from(event.to.children)
										.map((c) => c.getAttribute('data-code'))
										.filter((d) => d !== null);

									// re-order semester
									semesters = semesters.map((s, i) =>
										i === semesterIndex ? semesterCodes : s
									);
								},
								onAdd: (event) => {
									const code = event.item.getAttribute('data-code');
									if (code === null) {
										return;
									}

									const semesterCodes = Array.from(event.to.children)
										.map((c) => c.getAttribute('data-code'))
										.filter((d) => d !== null);

									// remove course from wishlist
									wishlist = wishlist.filter((c) => c !== code);

									semesters = semesters.map((s, i) =>
										i === semesterIndex
											? // deduplicate semester codes and preserve order
												[...new Set(semesterCodes)]
											: // remove course from other semesters
												s.filter((c) => c !== code)
									);
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
