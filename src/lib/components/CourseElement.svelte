<script lang="ts">
	import ScheduleErrorComponent from './ScheduleErrorComponent.svelte';

	import { generateColor } from '$lib/colors';
	import CourseWidth from './CourseWidth.svelte';
	import StudyDaysComponent from './StudyDaysComponent.svelte';
	import type { Snippet } from 'svelte';
	import Arrow from '$lib/components/Arrow.svelte';
	import Spinner from './Spinner.svelte';

	import { content } from '$lib/stores.svelte';

	type Props = {
		code: string;
		course: Promise<Course> | Course;
		squeeze?: boolean;
		note?: Snippet<[Course]>;
		scheduleError?: Promise<ScheduleError>;
		tests?: Promise<Course[]>;
		index?: number;
		styleOnCourse?: (course: Course) => Promise<string>;
		onOpen?: () => void;
	};

	let {
		code,
		course: _course,
		note,
		squeeze = false,
		scheduleError,
		tests,
		index = 0,
		styleOnCourse,
		onOpen
	}: Props = $props();

	const course = $derived.by(() => Promise.resolve(_course));

	let loaded = $state(false);
	let style = $state('');
	$effect(() => {
		course.then((course) => {
			loaded = true;
			if (styleOnCourse !== undefined) {
				styleOnCourse(course).then((s) => (style = s));
			}
		});
	});

	const color = $derived.by(() => generateColor(code));

	const hasTest = $derived.by(() =>
		course.then((c) => c.tests !== undefined && c.tests.length > 0)
	);

	const warningId = $props.id();
	let minimize = $state(true);
	let scheduleErrorButton: HTMLButtonElement | undefined = $state();
	const _scheduleError = $derived.by(async () => {
		if (scheduleError === undefined) {
			return false;
		} else if (
			await scheduleError.then(
				(se) =>
					se.season !== undefined ||
					se.dependencies.length > 0 ||
					se.adjacencies.length > 0 ||
					se.exclusives.length > 0
			)
		) {
			return await scheduleError;
		} else {
			return false;
		}
	});
</script>

{#snippet body()}
	<div class="course-body" class:course-body-squeezed={squeeze}>
		{#await course}
			<div class="course-loading" aria-hidden="true">
				<span></span><span></span>
			</div>
			<span class="sr-only">{content.lang.common.loading}</span>
		{:then course}
			<div
				class="course-name text-start font-medium text-content-primary"
				dir="auto"
				title={course.name}
			>
				{course.name ?? content.lang.common.na}
			</div>
		{/await}
		<div
			class="course-code-row flex min-w-0 items-center gap-1 text-content-secondary"
		>
			{#await hasTest then hasTest}
				<span
					style="background: {color}"
					class="course-marker {hasTest ? 'rounded-full' : 'rounded-sm'}"
					aria-hidden="true"
				></span>
			{/await}
			<span class="course-code" dir="ltr">{code}</span>
		</div>
		<div class="course-meta text-content-secondary">
			{#await course then course}
				{#if course.points !== undefined}
					<span
						class="course-points font-medium text-content-primary"
						title={content.lang.course.points}
					>
						<span class="sr-only"
							>{content.lang.course.points}:
						</span>{course.points}<span aria-hidden="true">
							{content.lang.lang === 'he' ? 'נק׳' : 'cr'}</span
						>
					</span>
				{/if}
			{/await}
		</div>
		{#await course then course}
			{#if note !== undefined || (!squeeze && course.median !== undefined)}
				<div class="course-extra text-content-secondary">
					{#if note !== undefined}<span class="min-w-0 truncate"
							>{@render note(course)}</span
						>{/if}
					{#if !squeeze && course.median !== undefined}
						<span class="shrink-0"
							>{content.lang.course.median} {course.median}</span
						>
					{/if}
				</div>
			{/if}
		{/await}
	</div>
{/snippet}

<div
	{style}
	class="course-card relative h-fit w-fit select-none bg-card-primary"
>
	<CourseWidth>
		<div class="course-summary">
			{#if onOpen}
				<button
					type="button"
					class="course-open w-full text-start"
					onclick={() => {
						if (minimize && scheduleErrorButton) minimize = false;
						else onOpen?.();
					}}>{@render body()}</button
				>
			{:else}
				{@render body()}
			{/if}
			{#if scheduleError !== undefined && loaded}
				{#await _scheduleError then _scheduleError}
					{#if _scheduleError}
						<button
							type="button"
							bind:this={scheduleErrorButton}
							aria-expanded={!minimize}
							aria-controls={minimize ? undefined : warningId}
							aria-label={content.lang.lang === 'he'
								? 'פרטי דרישות הקורס'
								: 'Course requirement details'}
							class="course-warning text-content-secondary"
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								minimize = !minimize;
							}}
						>
							<span aria-hidden="true" class="font-semibold text-accent-primary"
								>!</span
							>
							<span class="w-2.5" class:rotate-180={!minimize}><Arrow /></span>
						</button>
					{/if}
				{/await}
			{/if}
		</div>

		{#if tests !== undefined}
			<div class="course-footer">
				{#await course then course}<StudyDaysComponent
						{course}
						semester={tests}
					/>{/await}
			</div>
		{/if}
		{#if scheduleError !== undefined && loaded}
			{#await _scheduleError}
				<div
					class="course-footer flex items-center gap-1 text-xs text-content-secondary"
				>
					<div class="h-3 w-3 opacity-75"><Spinner /></div>
					{content.lang.course.checkingRequirements}
				</div>
			{:then _scheduleError}
				{#if _scheduleError && !minimize}
					<div id={warningId} class="course-warning-details">
						<ScheduleErrorComponent scheduleError={_scheduleError} />
					</div>
				{/if}
			{/await}
		{/if}
	</CourseWidth>
</div>

<style>
	.course-card {
		border-radius: var(--radius-card, 0.375rem);
		box-shadow: inset 0 0 0 0.0625rem rgb(var(--color-border));
		transition:
			box-shadow 160ms ease,
			background-color 160ms ease;
	}
	.course-card:hover {
		box-shadow: inset 0 0 0 0.0625rem rgb(var(--color-accent-primary) / 0.7);
	}
	.course-summary {
		position: relative;
	}
	.course-open {
		border-radius: var(--radius-card, 0.375rem);
	}
	.course-body {
		display: flex;
		min-block-size: 4.5rem;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.375rem;
	}
	.course-body-squeezed {
		min-block-size: 0;
	}
	.course-name {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
		overflow-wrap: normal;
		hyphens: none;
		font-size: 0.8125rem;
		line-height: 1.4;
	}
	.course-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
		margin-block-start: auto;
		font-size: 0.75rem;
		line-height: 1rem;
		font-variant-numeric: tabular-nums;
	}
	.course-summary:has(.course-warning) .course-meta,
	.course-summary:has(.course-warning) .course-extra {
		padding-inline-end: 1.875rem;
		min-block-size: 1.75rem;
	}
	.course-code-row {
		font-size: 0.6875rem;
		line-height: 0.875rem;
		font-variant-numeric: tabular-nums;
	}
	.course-code,
	.course-points {
		white-space: nowrap;
	}
	.course-marker {
		display: block;
		flex-shrink: 0;
		inline-size: 0.375rem;
		block-size: 0.375rem;
	}
	.course-extra {
		display: flex;
		justify-content: space-between;
		gap: 0.375rem;
		font-size: 0.6875rem;
		line-height: 1rem;
	}
	.course-footer,
	.course-warning-details {
		border-block-start: 0.0625rem solid rgb(var(--color-border));
	}
	.course-footer {
		padding: 0.375rem 0.5rem;
	}
	.course-warning {
		position: absolute;
		inset-inline-end: 0;
		inset-block-end: 0;
		display: flex;
		inline-size: 2.25rem;
		block-size: 2.25rem;
		align-items: center;
		justify-content: center;
		gap: 0.1875rem;
		border-radius: var(--radius-card, 0.375rem);
		font-size: 0.75rem;
	}
	.course-warning:hover {
		background: rgb(var(--color-card-secondary) / 0.5);
	}
	.course-warning:focus-visible {
		outline: 0.125rem solid rgb(var(--color-accent-primary));
		outline-offset: 0.125rem;
	}
	.course-loading {
		display: grid;
		gap: 0.375rem;
		padding-block: 0.25rem;
	}
	.course-loading span {
		block-size: 0.625rem;
		border-radius: 0.125rem;
		background: rgb(var(--color-content-secondary) / 0.15);
		animation: pulse 1.8s ease-in-out infinite;
	}
	.course-loading span:last-child {
		inline-size: 65%;
	}
	@keyframes pulse {
		50% {
			opacity: 0.4;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.course-card {
			transition: none;
		}
		.course-loading span {
			animation: none;
		}
	}
</style>
