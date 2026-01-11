<script lang="ts">
	import { generateColor } from '$lib/colors';
	import CourseWidth from './CourseWidth.svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		squeeze?: boolean;
		note?: Snippet;
	};

	let { note, squeeze = false }: Props = $props();

	const course = {
		code: '0000',
		median: undefined,
		points: undefined,
		name: undefined
	} as const satisfies Course;
	const color = generateColor(course.code);
	const hasTest = false;

	let minimize = $state(false);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="h-fit w-fit select-none justify-between rounded-md bg-card-secondary"
	onclick={(e) => {
		if (minimize) {
			e.preventDefault();
			e.stopPropagation();
			minimize = !minimize;
		}
	}}
>
	<CourseWidth>
		<div class="w-full rounded-md bg-card-primary p-2">
			<div
				class="flex flex-row items-center justify-between pb-1 text-xs text-content-secondary"
			>
				<div class="flex flex-row">
					{#await Promise.all([hasTest, color])}
						<div class="h-4 min-w-4 bg-gray-500"></div>
					{:then [hasTest, color]}
						<div
							style="background: {color}"
							class="h-4 min-w-4 {hasTest ? 'rounded-full' : ''}"
						></div>
					{/await}
					{#if note !== undefined}
						<span class="me-1 ms-1">
							{@render note()}
						</span>
					{/if}
				</div>
				<span>
					<span>{course.median ?? ''}</span>
					<span>{course.points ?? ''}</span>
				</span>
			</div>

			<div
				class="flex {squeeze
					? ''
					: 'min-h-20 sm:min-h-12'} flex-col justify-between"
			>
				<div class="text-right text-xs leading-none text-content-primary">
					<span class="hyphens-auto break-words" dir="rtl">
						{course.name}

						<span class="text-right leading-none text-content-secondary">
							{course.code}
						</span>
					</span>
				</div>
			</div>
		</div>
	</CourseWidth>
</div>
