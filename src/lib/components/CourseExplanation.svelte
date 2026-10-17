<script lang="ts">
	import { content } from '$lib/preferences.svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLElement> & {
		width?: number;
		height?: number;
	};
	let {
		class: className = '',
		width,
		height: _height,
		...rest
	}: Props = $props();
	const isHebrew = $derived(content.lang.lang === 'he');
</script>

<figure
	{...rest}
	class="course-explanation {className}"
	dir={content.lang.dir}
	style:max-width={width ? `${width / 16}rem` : undefined}
>
	<div class="example-card">
		<div class="example-meta">
			<span class="exam-marker" aria-hidden="true"></span>
			<div class="flex items-center gap-3">
				<span
					><span class="metric-label">{content.lang.course.median}</span><strong
						>87.5</strong
					></span
				>
				<span
					><span class="metric-label">{content.lang.course.points}</span><strong
						>5.5</strong
					></span
				>
			</div>
		</div>
		<div class="example-title">
			{isHebrew ? 'חשבון אינפיניטסימלי 1' : 'Calculus 1'}
		</div>
		<div class="example-code" dir="ltr">1040031</div>
	</div>
	<figcaption>
		<div>
			<span class="exam-marker" aria-hidden="true"></span>{isHebrew
				? 'קורס עם מבחן'
				: 'Course with an exam'}
		</div>
		<div>
			<span class="exam-marker no-exam" aria-hidden="true"></span>{isHebrew
				? 'קורס ללא מבחן'
				: 'Course without an exam'}
		</div>
	</figcaption>
</figure>

<style>
	.course-explanation {
		display: flex;
		inline-size: 100%;
		max-inline-size: 22rem;
		flex-direction: column;
		justify-content: center;
		gap: 1rem;
		margin-inline: auto;
		text-align: start;
	}
	.example-card {
		padding: 1rem;
		border: 0.0625rem solid rgb(var(--color-border));
		border-radius: var(--radius-card, 0.875rem);
		background: rgb(var(--color-card-primary));
		box-shadow: var(--shadow-card, 0 0.125rem 0.5rem rgb(0 0 0 / 0.06));
	}
	.example-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}
	.metric-label {
		display: block;
		margin-block-end: 0.125rem;
		color: rgb(var(--color-content-secondary));
		font-size: 0.625rem;
	}
	.example-title {
		margin-block: 0.75rem 0.375rem;
		color: rgb(var(--color-content-primary));
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.5;
	}
	.example-code {
		color: rgb(var(--color-content-secondary));
		font-size: 0.75rem;
		letter-spacing: 0.025em;
		text-align: start;
	}
	.exam-marker {
		display: inline-block;
		flex-shrink: 0;
		inline-size: 0.625rem;
		block-size: 0.625rem;
		border-radius: 999rem;
		background: #176f65;
	}
	.no-exam {
		border-radius: 0.125rem;
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		color: rgb(var(--color-content-secondary));
		font-size: 0.6875rem;
		line-height: 1.5;
	}
	figcaption > div {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
</style>
