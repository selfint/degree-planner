<script lang="ts">
	import ProgressBar from './ProgressBar.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';

	import ProgressElement from './ProgressElement.svelte';

	import { generateColor, generateRequirementColor } from '$lib/colors';
	import { getCourseLists } from '$lib/requirements';
	import { content, user } from '$lib/stores.svelte';

	type Props = {
		indent?: number;
		parents?: string[];
		degreeRequirements: Requirement;
		current?: Progress;
		planned: Progress;
	};

	const {
		indent = 0,
		parents = [],
		degreeRequirements,
		current,
		planned
	}: Props = $props();

	const name = $derived(planned.name);

	const requirementName = $derived(
		content.lang.lang === 'he' ? planned.he : planned.en
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

	const color = $derived(generateColor(name));
	const offset = $derived(`${indent * 0.75}rem`);
	const dir = $derived(content.lang.dir === 'rtl' ? 'right' : 'left');
	const margin = $derived(`margin-${dir}: ${offset}`);
	const progressStyle = $derived(
		`${margin}; max-width: calc(30rem - ${offset});`
	);

	const section = $derived(
		[...parents, name]
			.slice(1)
			.map((t) => t.toLowerCase())
			.join('_')
	);
	const href = $derived(`/catalog#${section}`);

	function getRequirement(
		requirement: Requirement | undefined,
		name: string | undefined
	): Requirement | undefined {
		if (requirement === undefined || name === undefined) {
			return undefined;
		}

		if (requirement.name === name) {
			return requirement;
		}

		for (const nested of requirement.nested ?? []) {
			const result = getRequirement(nested, name);
			if (result !== undefined) {
				return result;
			}
		}

		return undefined;
	}

	const requirementHasCourses = $derived(
		getRequirement(degreeRequirements, name)?.courses !== undefined
	);

	const targetRequirement = $derived(
		getRequirement(degreeRequirements, planned.overflow?.target)
	);

	function getCourseSemester(course: Course): number | undefined {
		const index = user.semesters.findIndex((s) => s.includes(course.code));

		if (index === -1) {
			return undefined;
		} else {
			return index;
		}
	}

	const seasonEmojis = ['❄️', '🌿', '☀️'];
</script>

<div id={section} class="mb-2 w-full">
	{#if requirementName.length > 0}
		<h3
			class="mb-0.5 w-fit rounded-md pl-2 pr-2 text-content-primary"
			style="background: {color}; {margin}"
		>
			{#if requirementHasCourses}
				<a {href}>
					{requirementName}
				</a>
			{:else}
				{requirementName}
			{/if}
		</h3>
	{/if}

	{#if planned.hook !== undefined}
		<div
			style={progressStyle}
			class="mb-0.5 me-2 mt-1.5 w-fit rounded-md bg-card-primary p-2 pb-1 pe-2 pt-1 text-content-secondary"
		>
			<span class="text-yellow-400"> ⚠ </span>
			<span>
				{content.lang.lang === 'he' ? planned.hook.he : planned.hook.en}
			</span>
		</div>
	{/if}

	{#if planned.points.done > 0}
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
				{#if planned.points.required > 0}
					/ {planned.points.required}
				{/if}
			</span>
		</div>
	{/if}

	{#if planned.count.done > 0}
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
				{#if planned.count.required > 0}
					/ {planned.count.required}
				{/if}
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
					{formatName(
						content.lang.lang === 'he'
							? (targetRequirement?.he ?? targetRequirement?.name ?? target)
							: (targetRequirement?.name ?? target)
					)}
				</a>
			</span>
		</span>
	{/if}

	<div class="mb-1 mt-1">
		<CourseRow {indent} courses={planned.courses.done ?? []}>
			{#snippet children({ course })}
				<a
					class={current?.courses?.done.some(({ code }) => code === course.code)
						? ''
						: 'opacity-50'}
					href={`/course/${course.code}`}
				>
					<CourseElement
						{course}
						lists={getCourseLists(degreeRequirements, course.code)}
					>
						{#snippet note()}
							{@const index = getCourseSemester(course)}
							{#if index !== undefined}
								<span>
									{seasonEmojis[index % 3]}
									<span class="hidden sm:inline">
										{content.lang.common.seasons[index % 3]}
										{Math.floor(index / 3) + 1}
									</span>
								</span>
							{:else if user.wishlist.includes(course.code)}
								<span>🌟</span>
								<span class="hidden sm:inline">
									{formatName(content.lang.catalog.wishlist)}
								</span>
							{/if}
						{/snippet}
					</CourseElement>
				</a>
			{/snippet}
		</CourseRow>
	</div>

	<div class="mt-2">
		{#each planned.nested.options as nested, i}
			<ProgressElement
				indent={indent + 1}
				parents={[...parents, name]}
				{degreeRequirements}
				current={current?.nested?.options[i]}
				planned={nested}
			/>
		{/each}
	</div>
</div>
