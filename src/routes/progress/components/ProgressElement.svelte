<script lang="ts">
	import { goto } from '$app/navigation';

	import Progress from '$lib/components/Progress.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';

	import ProgressElement from './ProgressElement.svelte';

	import { generateColor, generateRequirementColor } from '$lib/colors';
	import { getCourseData } from '$lib/courseData';
	import { getCourseLists } from '$lib/requirements';
	import { content } from '$lib/stores.svelte';

	type Props = {
		indent?: number;
		parents?: string[];
		degreeRequirements: DegreeRequirements;
		requirementName: string;
		requirement: Requirement;
		current?: RequirementProgress;
		planned: RequirementProgress;
	};

	const {
		indent = 0,
		parents = [],
		degreeRequirements,
		requirementName,
		requirement,
		current,
		planned
	}: Props = $props();

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
		.map((t) => t.toLowerCase())
		.join('_');
	const href = `/catalog#${section}`;
</script>

<div id={section} class="mb-2 w-full">
	<h3
		class="mb-1 w-fit rounded-md pl-2 pr-2 text-content-primary"
		style="background: {color}; {margin}"
	>
		{#if requirement.choice === undefined}
			<a {href}>
				{formatName(requirementName)}
			</a>
		{:else}
			{formatName(requirementName)}
		{/if}
	</h3>

	{#if requirement.points !== undefined && planned.points !== undefined}
		<div
			class="flex flex-row items-center text-content-secondary ltr:pr-2 rtl:pl-2"
			style={progressStyle}
		>
			<span class="ltr:mr-2 rtl:ml-2">{content.lang.progress.points}</span>
			<Progress
				{color}
				value={current?.points ?? 0}
				value2={planned.points}
				max={requirement.points}
			/>
			<span class="text-nowrap ltr:ml-2 rtl:mr-2">
				<span style="color: {color}">{current?.points ?? 0}</span>
				/ {planned.points}
				/ {requirement.points}
			</span>
		</div>
	{/if}

	{#if requirement.count !== undefined && planned.count !== undefined}
		<div
			class="flex flex-row items-center text-content-secondary ltr:pr-2 rtl:pl-2"
			style={progressStyle}
		>
			<span class="ltr:mr-2 rtl:ml-2">{content.lang.progress.count}</span>
			<Progress
				{color}
				value={current?.count ?? 0}
				value2={planned.count}
				max={requirement.count}
			/>
			<span class="text-nowrap ltr:ml-2 rtl:mr-2">
				<span style="color: {color}">{current?.count ?? 0}</span>
				/ {planned.count}
				/ {requirement.count}
			</span>
		</div>
	{/if}

	{#if requirement.overflow !== undefined && planned.overflow !== undefined}
		{@const [target, type, amount] = planned.overflow}
		<span class="text-content-secondary ltr:ml-3 rtl:mr-3">
			{content.lang.progress.overflowed}
			{amount}
			{type}
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

	{#if planned.courses?.length ?? 0 > 0}
		<div class="mb-1 mt-1 flex flex-row overflow-x-auto">
			<div style={margin}></div>
			{#each current?.courses ?? [] as course, i}
				<div
					class="ltr:mr-2 rtl:ml-2"
					tabindex={i}
					role="button"
					onmousedown={() => goto(`/course/${course}`)}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							goto(`/course/${course}`);
						}
					}}
				>
					<CourseElement
						course={getCourseData(course)}
						lists={getCourseLists(degreeRequirements, course)}
					/>
				</div>
			{/each}
			{#each planned.courses?.filter((c) => !current?.courses?.includes(c)) ?? [] as course, i}
				<div
					class="opacity-50 ltr:mr-2 rtl:ml-2"
					tabindex={i}
					role="button"
					onmousedown={() => goto(`/course/${course}`)}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							goto(`/course/${course}`);
						}
					}}
				>
					<CourseElement
						course={getCourseData(course)}
						lists={getCourseLists(degreeRequirements, course)}
					/>
				</div>
			{/each}
		</div>
	{/if}

	{#if requirement.choice !== undefined && planned.choice !== undefined}
		<div
			class="mb-1 flex flex-row items-center text-content-secondary ltr:pr-2 rtl:pl-2"
			style={progressStyle}
		>
			<span class="ltr:mr-2 rtl:ml-2">{content.lang.progress.choice}</span>
			<Progress
				{color}
				value={current?.choice?.amount ?? 0}
				value2={planned.choice.amount}
				max={requirement.choice?.amount}
			/>
			<span class="text-nowrap ltr:ml-2 rtl:mr-2">
				<span style="color: {color}">{current?.choice?.amount ?? 0}</span>
				/ {planned.choice.amount}
				/ {requirement.choice?.amount}
			</span>
		</div>
		<div>
			{#each planned.choice.options as [name, [subRequirement, subProgress]]}
				<ProgressElement
					indent={indent + 1}
					parents={[...parents, requirementName]}
					{degreeRequirements}
					requirementName={name}
					requirement={subRequirement}
					current={current?.choice?.options.get(name)?.[1]}
					planned={subProgress}
				/>
			{/each}
		</div>
	{/if}
</div>
