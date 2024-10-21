<script lang="ts">
	import ProgressBar from './ProgressBar.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';

	import ProgressElement from './ProgressElement.svelte';

	import { generateColor, generateRequirementColor } from '$lib/colors';
	import { getCourseLists } from '$lib/requirements';
	import { content } from '$lib/stores.svelte';

	type Props = {
		indent?: number;
		parents?: string[];
		degreeRequirements: Requirement;
		requirementName: string;
		current?: Progress;
		planned: Progress;
	};

	const {
		indent = 0,
		parents = [],
		degreeRequirements,
		requirementName,
		current,
		planned
	}: Props = $props();

	const name = $derived(
		content.lang.lang === 'he' ? (planned.he ?? planned.name) : planned.name
	);

	function formatName(name: string): string {
		return (
			name[0].toUpperCase() +
			name
				.slice(1)
				.toLowerCase()
				.split('_')
				.map((word) => (word.length > 2 ? word : word.toUpperCase()))
				.join(' ')
		);
	}

	const color = generateColor(requirementName);
	const offset = `${indent * 0.75}rem`;
	const dir = $derived(content.lang.dir === 'rtl' ? 'right' : 'left');
	const margin = $derived(`margin-${dir}: ${offset}`);
	const progressStyle = $derived(
		`${margin}; max-width: calc(30rem - ${offset});`
	);

	const section = [...parents, requirementName]
		.slice(1)
		.map((t) => t.toLowerCase())
		.join('_');
	const href = `/catalog#${section}`;

	const requirementHasConditions = $derived(
		planned.count.required > 0 ||
			planned.points.required > 0 ||
			(planned.amount.required > 0 &&
				planned.amount.required < planned.nested.options.length)
	);
</script>

<div id={section} class="mb-2 w-full">
	{#if requirementName.length > 0}
		<h3
			class="mb-1 w-fit rounded-md pl-2 pr-2 text-content-primary"
			style="background: {color}; {margin}"
		>
			{#if requirementHasConditions}
				<a {href}>
					{formatName(name)}
				</a>
			{:else}
				{formatName(name)}
			{/if}
		</h3>
	{/if}

	{#if planned.points.required > 0}
		<div
			class="flex flex-row items-center pe-2 text-content-secondary"
			style={progressStyle}
		>
			<span class="me-2">{content.lang.progress.points}</span>
			<ProgressBar
				{color}
				value={current?.points.done ?? 0}
				value2={planned.points.done}
				max={planned.points.required}
				dir={content.lang.dir}
			/>
			<span class="ms-2 text-nowrap">
				<span style="color: {color}">{current?.points.done ?? 0}</span>
				/ {planned.points.done}
				/ {planned.points.required}
			</span>
		</div>
	{/if}

	{#if planned.count.required > 0}
		<div
			class="flex flex-row items-center pe-2 text-content-secondary"
			style={progressStyle}
		>
			<span class="me-2">{content.lang.progress.count}</span>
			<ProgressBar
				{color}
				value={current?.count.done ?? 0}
				value2={planned.count.done}
				max={planned.count.required}
				dir={content.lang.dir}
			/>
			<span class="ms-2 text-nowrap">
				<span style="color: {color}">{current?.count.done ?? 0}</span>
				/ {planned.count.done}
				/ {planned.count.required}
			</span>
		</div>
	{/if}

	{#if planned.overflow !== undefined}
		{@const { target, type, value } = planned.overflow}
		<span class="ms-3 text-content-secondary" style={progressStyle}>
			{content.lang.progress.overflowed}
			{value}
			{type === 'count'
				? content.lang.progress.count
				: content.lang.progress.points}
			{content.lang.progress.to}
			<span
				class="mb-1 w-fit rounded-md pl-2 pr-2 text-content-primary"
				style="background: {generateRequirementColor(target)};"
			>
				<a href="#{target.toLowerCase()}">
					{formatName(target)}
				</a>
			</span>
		</span>
	{/if}

	{#if requirementHasConditions && planned.courses.done.length > 0}
		<div class="mb-1 mt-1">
			<CourseRow {indent} courses={planned.courses.done ?? []}>
				{#snippet children({ course })}
					<a
						class={current?.courses?.done.some(
							({ code }) => code === course.code
						)
							? ''
							: 'opacity-50'}
						href={`/course/${course.code}`}
					>
						<CourseElement
							{course}
							lists={getCourseLists(degreeRequirements, course.code)}
						/>
					</a>
				{/snippet}
			</CourseRow>
		</div>
	{/if}

	{#if planned.amount.required > 0}
		{#if planned.amount.required < planned.nested.options.length}
			<div
				class="mb-1 flex flex-row items-center pe-2 text-content-secondary"
				style={progressStyle}
			>
				<span class="me-2">{content.lang.progress.choice}</span>
				<ProgressBar
					{color}
					value={current?.amount.done ?? 0}
					value2={planned.amount.done}
					max={planned.amount.required}
					dir={content.lang.dir}
				/>
				<span class="ms-2 text-nowrap">
					<span style="color: {color}">{current?.amount.done ?? 0}</span>
					/ {planned.amount.done}
					/ {planned.amount.required}
				</span>
			</div>
		{/if}
		<div class="mt-2">
			{#each planned.nested.options as nested, i}
				<ProgressElement
					indent={indent + 1}
					parents={[...parents, requirementName]}
					{degreeRequirements}
					requirementName={nested.name}
					current={current?.nested?.options[i]}
					planned={nested}
				/>
			{/each}
		</div>
	{/if}
</div>
