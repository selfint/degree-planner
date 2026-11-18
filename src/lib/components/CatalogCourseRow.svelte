<script lang="ts">
	import { resolve } from '$app/paths';
	import { content } from '$lib/stores.svelte';
	import { generateColor } from '$lib/colors';
	import { keyedItems } from '$lib/keyedItems';
	let {
		courses,
		getNote
	}: {
		courses: Course[];
		getNote: (course: Course) => { symbol: string; label: string } | undefined;
	} = $props();
	const ordered = $derived(
		[...courses].sort(
			(a, b) =>
				(b.median ?? 0) - (a.median ?? 0) || a.code.localeCompare(b.code)
		)
	);
	function label(course: Course, note: ReturnType<typeof getNote>) {
		return [
			note?.label,
			course.median === undefined
				? undefined
				: `${content.lang.course.median}: ${course.median}`,
			course.points === undefined
				? undefined
				: `${content.lang.course.points}: ${course.points}`,
			course.name,
			course.code
		]
			.filter(Boolean)
			.join(' ');
	}
</script>

<!-- Keep every real link and all searchable text mounted. This row accepts only
     resolved data, so it needs no per-card async state, effects or loading nodes. -->
<div class="course-row catalog-course-row">
	<div class="margin" aria-hidden="true"></div>
	{#each keyedItems(ordered, (course) => course.code) as { key, value: course } (key)}
		{@const note = getNote(course)}
		<a
			class="course-card course-body course-width select-none bg-card-primary"
			href={resolve(`/app/course/${course.code}`)}
			data-code={course.code}
			aria-label={label(course, note)}
		>
			<span
				class="course-meta text-content-secondary"
				aria-hidden="true"
				style:--course-color={generateColor(course.code)}
				class:has-test={!!course.tests?.length}
			>
				{#if note}<span class="course-note"
						>{note.symbol}<span class="hidden sm:inline">
							{note.label}</span
						></span
					>{/if}
				<span class="course-stats" dir="ltr">
					{#if course.median !== undefined}<span
							class="course-median"
							title={content.lang.course.median}>{course.median}</span
						>{/if}
					{#if course.points !== undefined}<span
							class="course-points text-content-primary"
							title={content.lang.course.points}>{course.points}</span
						>{/if}
				</span>
			</span>
			<span class="course-copy text-start text-content-primary" dir="auto">
				<span class="course-name" title={course.name}>{course.name}</span
				>&#32;<span class="course-code text-content-secondary" dir="ltr"
					>{course.code}</span
				>
			</span>
		</a>
	{/each}
</div>

<style>
	.catalog-course-row {
		display: flex;
		overflow-x: auto;
		padding-block-end: 0.25rem;
		scrollbar-width: thin;
		scrollbar-color: rgb(var(--color-content-secondary) / 0.4) transparent;
	}
	.margin {
		margin-inline-end: 0.75rem;
	}
	.course-card {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		gap: 0.25rem;
		padding: 0.375rem;
		margin-inline-end: 0.5rem;
		inline-size: calc((100vw - 2.5rem) / 3.25);
		font-weight: 400;
		border-radius: var(--radius-card, 0.375rem);
		box-shadow: inset 0 0 0 0.0625rem rgb(var(--color-border));
		transition:
			box-shadow 160ms ease,
			background-color 160ms ease;
	}
	.course-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		line-height: 1rem;
		font-variant-numeric: tabular-nums;
	}
	.course-meta::before {
		content: '';
		display: block;
		flex-shrink: 0;
		inline-size: 1em;
		block-size: 1em;
		background: var(--course-color);
		border-radius: 0.125rem;
	}
	.course-meta.has-test::before {
		border-radius: 9999px;
	}
	.course-note {
		flex: 1;
		min-inline-size: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.course-stats {
		display: flex;
		flex-shrink: 0;
		gap: 0.375rem;
	}
	.course-copy {
		display: block;
		min-block-size: 4.5rem;
		overflow-wrap: break-word;
		hyphens: auto;
		font-size: 0.75rem;
		line-height: 1;
	}
	.course-name {
		display: -webkit-inline-box;
		max-inline-size: 100%;
		vertical-align: bottom;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
	}
	.course-code {
		display: inline-block;
		vertical-align: bottom;
		font-variant-numeric: tabular-nums;
		unicode-bidi: isolate;
		white-space: nowrap;
	}
	@media (min-width: 40rem) {
		.course-card {
			inline-size: 10.5rem;
		}
	}
	@media (hover: hover) and (pointer: fine) {
		.course-card:hover {
			box-shadow: inset 0 0 0 0.0625rem rgb(var(--color-accent-primary) / 0.7);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.course-card {
			transition: none;
		}
	}
</style>
