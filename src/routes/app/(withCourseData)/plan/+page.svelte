<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { updateSafety } from '$lib/pwa/update-safety';
	import { browser } from '$app/environment';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';

	import { user, content, writeStorage, setUser } from '$lib/stores.svelte';

	import { getScheduleError } from '$lib/schedule';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import PlanActionButton from '$lib/components/PlanActionButton.svelte';
	import { startPlanDrag, endPlanDrag, makePlanSortable } from '$lib/planDrag';
	import { fitPlanToViewport } from '$lib/fitPlanToViewport';
	import { initializePlanScroll } from '$lib/initializePlanScroll';

	const { data: pageData } = $props();
	const { getCourseData } = $derived(pageData);
	// Touch drags need fallback listeners even where native HTML dragging exists.
	const touchDrag = browser && navigator.maxTouchPoints > 0;

	let wishlist = $state(user.d.wishlist);
	let semesters = $state(user.d.semesters);
	const hasChanges = $derived(
		wishlist !== user.d.wishlist || semesters !== user.d.semesters
	);

	onMount(() => updateSafety.register(() => hasChanges));
	$effect(() => {
		void hasChanges;
		updateSafety.refresh();
	});

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

		const link = `/app/preview/${year}/${faculty}/${degree}?${urlParams}`;

		return link;
	});

	async function onCancel() {
		updateSafety.discardFailure();
		wishlist = user.d.wishlist;
		semesters = user.d.semesters;
	}

	let buttonNamespace = $state('');
	async function onSave() {
		setUser(await writeStorage({ ...user.d, wishlist, semesters }));
	}
</script>

<!-- Fill the remaining viewport while letting long plans grow naturally. -->
<div use:fitPlanToViewport class="plan-page mb-2 mt-2 flex flex-col">
	<div class="mb-3 flex shrink-0 flex-col gap-1">
		<div
			class="plan-toolbar me-3 ms-3 flex min-h-9 shrink-0 flex-row items-center justify-between gap-3 sm:me-5 sm:ms-5"
		>
			<h1 class="wishlist-heading text-sm font-semibold text-content-primary">
				{content.lang.plan.wishlist}
			</h1>
			<div class="flex flex-row items-center gap-x-1 text-sm">
				{#if hasChanges}
					<AsyncButton
						variant="secondary"
						onclick={onCancel}
						bind:buttonNamespace
						name="cancel"
					>
						{content.lang.settings.cancel}
					</AsyncButton>
					<PlanActionButton
						variant="primary"
						onclick={onSave}
						bind:buttonNamespace
						name="save"
					>
						{content.lang.settings.save}
					</PlanActionButton>
				{/if}
				{#if shareLink && user.d.semesters.some((s) => s.length > 0)}
					<a
						href={shareLink}
						target="_blank"
						rel="noopener noreferrer"
						class="plan-share ui-button ui-button--primary"
					>
						{content.lang.settings.share}
					</a>
				{/if}
			</div>
		</div>
		<div
			data-testid="wishlist-scroller"
			data-plan-scroll
			use:initializePlanScroll={content.lang.dir}
			dir="ltr"
			class="plan-rail flex min-h-0 flex-row overflow-x-auto overflow-y-hidden pb-1"
		>
			{#key wishlist.join(' ')}
				<div
					data-testid="plan-wishlist"
					use:makePlanSortable={{
						group: 'semesters',
						// Keep the touch preview outside transformed/clipped scrollers.
						fallbackOnBody: true,
						forceFallback: touchDrag,
						onStart: startPlanDrag,
						onEnd: endPlanDrag,
						scroll: !touchDrag,
						bubbleScroll: false,
						sort: true,
						direction: 'horizontal',
						animation: 100,
						delay: 100,
						filter: '.margin',
						delayOnTouchOnly: true,
						dataIdAttr: 'data-code',
						ghostClass: 'wishlist-ghost',
						onUpdate: (event) => {
							const code = event.item.getAttribute('data-code');
							if (code === null) {
								return;
							}

							const wishlistCodes = Array.from(event.to.children)
								.map((c) => c.getAttribute('data-code'))
								.filter((d) => d !== null) as CourseCode[];

							// deduplicate wishlist and preserve order
							wishlist = [...new Set(wishlistCodes)];
						},
						onAdd: (event) => {
							const code = event.item.getAttribute('data-code');
							if (code === null) {
								return;
							}

							const wishlistCodes = Array.from(event.to.children)
								.map((c) => c.getAttribute('data-code'))
								.filter((d) => d !== null) as CourseCode[];

							// deduplicate wishlist and preserve order
							wishlist = [...new Set(wishlistCodes)];

							// remove wishlist from semesters
							semesters = semesters.map((s) =>
								s.filter((c) => !wishlist.includes(c))
							);
						}
					}}
					dir={content.lang.dir}
					class="wishlist-rail me-3 ms-3 flex min-h-12 min-w-[calc(100%-1.5rem)] shrink-0 flex-row items-stretch justify-start gap-x-2 sm:me-5 sm:ms-5 sm:min-w-[calc(100%-2.5rem)]"
				>
					{#each wishlist as course}
						<button
							data-code={course}
							dir={content.lang.dir}
							class="shrink-0 rounded-[var(--radius-card)] text-start"
							onclick={() => goto(`/app/course/${course}`)}
						>
							<CourseElement
								code={course}
								course={getCourseData(course)}
								squeeze={true}
							/>
						</button>
					{/each}
				</div>
			{/key}
		</div>
	</div>
	<div
		data-testid="semester-scroller"
		data-plan-scroll
		dir="ltr"
		use:initializePlanScroll={content.lang.dir}
		style="transform: rotateX(180deg)"
		class="plan-rail flex flex-1 overflow-x-auto pb-2"
	>
		<div
			dir={content.lang.dir}
			style="transform: rotateX(180deg)"
			class="semester-board"
		>
			{#key semesters.map((s) => s.join('-')).join(',')}
				{#each semesters as semester, semesterIndex}
					<Semester
						board
						{getCourseData}
						index={semesterIndex}
						{semester}
						isCurrent={semesterIndex === user.d.currentSemester}
						href={`/app/semester?c=${semesterIndex}`}
						sortable={{
							group: 'semesters',
							// Keep the touch preview outside transformed/clipped scrollers.
							fallbackOnBody: true,
							forceFallback: touchDrag,
							onStart: startPlanDrag,
							onEnd: endPlanDrag,
							scroll: !touchDrag,
							bubbleScroll: false,
							dataIdAttr: 'data-code',
							sort: true,
							animation: 100,
							delay: 100,
							delayOnTouchOnly: true,
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
								) as CourseCode[][];
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
								) as CourseCode[][];
							}
						}}
					>
						{#snippet children({ code, course })}
							<div
								class="touch-manipulation rounded-[var(--radius-card)] text-start text-content-primary"
								data-code={code}
								dir={content.lang.dir}
							>
								<CourseElement
									onOpen={() => goto(`/app/course/${code}`)}
									{code}
									{course}
									squeeze={true}
									scheduleError={getScheduleError(
										getCourseData,
										course,
										user.d.exemptions,
										semesters,
										semesterIndex
									)}
								/>
							</div>
						{/snippet}
					</Semester>
				{/each}
			{/key}
		</div>
	</div>
</div>

<style>
	.wishlist-heading {
		flex-shrink: 0;
		white-space: nowrap;
	}
	.plan-share {
		min-inline-size: var(--control-height);
		padding-inline: 0.5rem;
		background: #0f6f67;
		color: #fff;
	}
	.wishlist-rail > button {
		display: flex;
	}
	.semester-board {
		display: grid;
		flex: 1;
		grid-auto-flow: column;
		grid-auto-columns: max-content;
		grid-template-rows: auto auto minmax(8rem, 1fr);
		column-gap: 0.5rem;
		padding-inline: 0.75rem;
	}
	@media (min-width: 40rem) {
		.semester-board {
			padding-inline: 1.25rem;
		}
	}
	.plan-rail {
		scrollbar-width: thin;
		scrollbar-color: rgb(var(--color-content-secondary) / 0.4) transparent;
	}
	.wishlist-rail:empty {
		align-items: center;
		border: 0.0625rem dashed rgb(var(--color-border));
		border-radius: var(--radius-card, 0.875rem);
		background: rgb(var(--color-card-primary) / 0.4);
	}
	:global(.wishlist-ghost) {
		max-block-size: 7.25rem;
		inline-size: calc((100vw - 2.5rem) / 3.25);
		overflow-y: hidden;
	}
	@media (min-width: 40rem) {
		:global(.wishlist-ghost) {
			inline-size: 10.5rem;
		}
	}
</style>
