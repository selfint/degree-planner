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
		<div
			class="course-meta flex items-center justify-between gap-1 text-content-secondary"
		>
			<div class="flex min-w-0 items-center gap-1">
				{#await hasTest}
					<span
						style="background: {color}"
						class="course-marker"
						aria-hidden="true"
					></span>
				{:then hasTest}
					<span
						style="background: {color}"
						class="course-marker {hasTest ? 'rounded-full' : 'rounded-sm'}"
						aria-hidden="true"
					></span>
				{/await}
				{#if note !== undefined}
					<span class="min-w-0 truncate">
						{#await course then course}
							{@render note(course)}
						{/await}
					</span>
				{/if}
			</div>
			<div class="flex shrink-0 items-center gap-1.5 tabular-nums" dir="ltr">
				{#await course then course}
					{#if course.median !== undefined}
						<span title={content.lang.course.median}>
							<span class="sr-only"
								>{content.lang.course.median}:
							</span>{course.median}
						</span>
					{/if}
					{#if course.median !== undefined && course.points !== undefined}
						<span class="opacity-50" aria-hidden="true">·</span>
					{/if}
					{#if course.points !== undefined}
						<span
							class="font-semibold text-content-primary"
							title={content.lang.course.points}
						>
							<span class="sr-only"
								>{content.lang.course.points}:
							</span>{course.points}
						</span>
					{/if}
				{/await}
			</div>
		</div>

		{#await course}
			<div class="course-loading" aria-hidden="true">
				<span></span><span></span>
			</div>
			<span class="sr-only">{content.lang.common.loading}</span>
		{:then course}
			<div class="course-copy text-start">
				<div
					class="course-name break-words font-medium text-content-primary"
					dir="auto"
				>
					{course.name ?? content.lang.common.na}
				</div>
				<div class="course-code text-content-secondary" dir="ltr">
					{course.code}
				</div>
			</div>
		{/await}
	</div>
{/snippet}

<div
	{style}
	class="course-card relative h-fit w-fit select-none bg-card-primary"
>
	<CourseWidth>
		{#if onOpen}
			<button
				type="button"
				class="course-open w-full text-start"
				onclick={() => {
					if (minimize && scheduleErrorButton) minimize = false;
					else onOpen?.();
				}}
			>
				{@render body()}
			</button>
		{:else}
			{@render body()}
		{/if}

		{#if tests !== undefined}
			<div class="course-footer">
				{#await course then course}
					<StudyDaysComponent {course} semester={tests} />
				{/await}
			</div>
		{/if}

		{#if scheduleError !== undefined && loaded}
			{#await _scheduleError}
				<div
					class="course-footer flex items-center gap-1 text-xs text-content-secondary"
				>
					<div class="h-4 w-4 opacity-75"><Spinner /></div>
					{content.lang.course.checkingRequirements}
				</div>
			{:then _scheduleError}
				{#if _scheduleError}
					{#if !minimize}
						<div id={warningId} class="course-warning-details">
							<ScheduleErrorComponent scheduleError={_scheduleError} />
						</div>
					{/if}
					<button
						type="button"
						bind:this={scheduleErrorButton}
						aria-expanded={!minimize}
						aria-controls={minimize ? undefined : warningId}
						aria-label={content.lang.lang === 'he'
							? 'פרטי דרישות הקורס'
							: 'Course requirement details'}
						class="course-warning w-full text-content-secondary"
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							minimize = !minimize;
						}}
					>
						<div
							class="flex min-h-11 items-center justify-center gap-1.5 text-xs"
						>
							<span aria-hidden="true" class="text-accent-primary">!</span>
							<div class="w-3" class:rotate-180={!minimize}><Arrow /></div>
						</div>
					</button>
				{/if}
			{/await}
		{/if}
	</CourseWidth>
</div>

<style>
	.course-card {
		border-radius: var(--radius-card, 0.875rem);
		box-shadow:
			inset 0 0 0 0.0625rem rgb(var(--color-border)),
			var(--shadow-card, 0 0.125rem 0.5rem rgb(0 0 0 / 0.06));
		transition:
			box-shadow 160ms ease,
			background-color 160ms ease;
	}

	.course-card:hover {
		box-shadow:
			inset 0 0 0 0.0625rem rgb(var(--color-accent-primary) / 0.6),
			var(--shadow-card, 0 0.125rem 0.5rem rgb(0 0 0 / 0.06));
	}

	.course-open {
		border-radius: var(--radius-card);
	}
	.course-warning-details {
		border-block-start: 0.0625rem solid rgb(var(--color-border));
	}

	.course-body {
		display: flex;
		min-block-size: 6.5rem;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.625rem;
	}

	.course-body-squeezed {
		min-block-size: 0;
	}

	.course-meta {
		font-size: 0.75rem;
		line-height: 1rem;
	}
	.course-marker {
		display: block;
		flex-shrink: 0;
		inline-size: 0.625rem;
		block-size: 0.625rem;
	}
	.course-copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.375rem;
	}
	.course-name {
		font-size: 0.875rem;
		line-height: 1.45;
	}
	.course-code {
		font-size: 0.6875rem;
		line-height: 1rem;
		letter-spacing: 0.025em;
		font-variant-numeric: tabular-nums;
		text-align: start;
	}
	.course-footer {
		border-block-start: 0.0625rem solid rgb(var(--color-border));
		padding: 0.5rem 0.625rem;
	}
	.course-warning {
		border-block-start: 0.0625rem solid rgb(var(--color-border));
		border-radius: 0 0 var(--radius-card, 0.875rem) var(--radius-card, 0.875rem);
		background: rgb(var(--color-card-secondary) / 0.25);
	}
	.course-warning:focus-visible {
		outline: 0.125rem solid rgb(var(--color-accent-primary));
		outline-offset: 0.125rem;
	}
	.course-loading {
		display: grid;
		gap: 0.5rem;
		padding-block: 0.375rem;
	}
	.course-loading span {
		block-size: 0.625rem;
		border-radius: 0.25rem;
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
