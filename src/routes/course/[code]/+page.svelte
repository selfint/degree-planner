<script lang="ts">
	import { page } from '$app/state';

	import Button from '$lib/components/Button.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';

	import {
		user,
		catalog,
		content,
		writeStorage,
		setUser
	} from '$lib/stores.svelte';

	import { getCourseData, getAllCourses } from '$lib/courseData';
	import { getCourseLists } from '$lib/requirements';
	import { generateCourseColor } from '$lib/colors';
	import RequirementsElement from '$lib/components/RequirementsElement.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';

	const code = $derived(page.params.code);
	const course = $derived(getCourseData(code));
	const requirements = $derived(catalog()?.requirement);

	const courseMemberRequirements = $derived.by(() => {
		if (requirements === undefined) {
			return [];
		}

		return getCourseLists(requirements, code);
	});

	const dependencies = $derived(
		course.connections?.dependencies.filter((g) => g.length > 0) ?? []
	);

	const dependants = $derived(
		getAllCourses()
			.filter((c) =>
				(c.connections?.dependencies ?? []).some((group) =>
					group.includes(code)
				)
			)
			.filter((c) => c.code !== undefined && c.name !== undefined)
			.toSorted((a, b) => {
				const medians = (b.median ?? 0) - (a.median ?? 0);

				if (medians !== 0) {
					return medians;
				}

				return a.code.localeCompare(b.code);
			})
	);

	let buttonNamespace = $state('');

	async function planCourse(): Promise<void> {
		setUser(
			await writeStorage({
				...user.d,
				semesters: user.d.semesters.map((s, i) =>
					i === user.d.currentSemester ? [...new Set([...s, code])] : s
				),
				wishlist: user.d.wishlist.filter((c) => c !== code)
			})
		);
	}

	async function removeCourseFromSemesters(): Promise<void> {
		setUser(
			await writeStorage({
				...user.d,
				semesters: user.d.semesters.map((s) => s.filter((c) => c !== code))
			})
		);
	}

	async function addCourseToExemptions(): Promise<void> {
		setUser(
			await writeStorage({
				...user.d,
				exemptions: [...new Set([...user.d.exemptions, code])]
			})
		);
	}

	async function removeCourseFromExemptions(): Promise<void> {
		setUser(
			await writeStorage({
				...user.d,
				exemptions: user.d.exemptions.filter((c) => c !== code)
			})
		);
	}

	async function addCourseToWishlist(): Promise<void> {
		setUser(
			await writeStorage({
				...user.d,
				wishlist: [...new Set([...user.d.wishlist, code])]
			})
		);
	}

	async function removeCourseFromWishlist(): Promise<void> {
		setUser(
			await writeStorage({
				...user.d,
				wishlist: user.d.wishlist.filter((c) => c !== code)
			})
		);
	}

	function getSeasonAndIndex(semesterIndex: number): string {
		const season = content.lang.common.seasons[semesterIndex % 3];
		const modIndex = Math.floor(semesterIndex / 3) + 1;
		return `${season} ${modIndex}`;
	}

	let depRow: HTMLDivElement | undefined = $state(undefined);
	$effect(() => {
		if (depRow) {
			// hack to get this effect to run each time the course changes
			depRow.scrollLeft = code.length - code.length;
		}
	});

	type CourseState = 'planned' | 'wished' | 'exempt' | 'none';
	const courseState = $derived.by((): CourseState => {
		if (user.d.semesters.flat().includes(code)) {
			return 'planned';
		}

		if (user.d.exemptions.includes(code)) {
			return 'exempt';
		}

		if (user.d.wishlist.includes(code)) {
			return 'wished';
		}

		return 'none';
	});
</script>

<div class="mt-3">
	<h1 class="ms-3 text-lg font-medium text-content-primary">
		<div class="flex flex-row flex-wrap items-center gap-x-1 leading-tight">
			<div class="m-0 mb-1 mt-1 p-0">
				<div
					style="background: {generateCourseColor(course)}"
					class="h-4 w-4 rounded-full"
				></div>
			</div>
			<span dir="rtl">
				{course.name ?? code}
			</span>

			<a
				href={`https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2024/200/SM/${code}`}
				target="_blank"
			>
				<span class="text-content-secondary">
					{course.code}
				</span>
			</a>
		</div>
	</h1>

	<p class="mb-4 ml-3 mr-3 mt-3 text-content-secondary" dir="rtl">
		{course.about}
	</p>

	<div class="ml-3 mr-3 flex flex-row items-center gap-x-1">
		{#if courseState === 'planned'}
			<AsyncButton
				variant="secondary"
				onclick={removeCourseFromSemesters}
				bind:buttonNamespace
				name="un-plan"
			>
				{content.lang.course.removeFromSemester}
				{getSeasonAndIndex(
					user.d.semesters.findIndex((s) => s.includes(course.code))
				)}
			</AsyncButton>
		{:else}
			<AsyncButton
				variant="primary"
				onclick={planCourse}
				bind:buttonNamespace
				name="plan"
			>
				{content.lang.course.plan}
			</AsyncButton>
			{#if courseState === 'wished'}
				<AsyncButton
					variant="secondary"
					onclick={removeCourseFromWishlist}
					bind:buttonNamespace
					name="un-wish"
				>
					{content.lang.course.removeFromWishlist}
				</AsyncButton>
			{:else if courseState === 'exempt'}
				<AsyncButton
					variant="secondary"
					onclick={removeCourseFromExemptions}
					bind:buttonNamespace
					name="un-exempt"
				>
					{content.lang.course.removeFromExemption}
				</AsyncButton>
			{:else}
				<AsyncButton
					variant="secondary"
					onclick={addCourseToWishlist}
					bind:buttonNamespace
					name="wish"
				>
					{content.lang.course.wishlist}
				</AsyncButton>
				<AsyncButton
					variant="secondary"
					onclick={addCourseToExemptions}
					bind:buttonNamespace
					name="exempt"
				>
					{content.lang.course.exempt}
				</AsyncButton>
			{/if}
		{/if}
	</div>

	<div class="ms-3 mt-4">
		<h2 class="text-lg font-medium text-content-primary">
			{content.lang.course.appliesTo}
		</h2>
		<div class="text-content-secondary">
			<RequirementsElement requirements={courseMemberRequirements} />
		</div>
	</div>

	<div class="ms-3 mt-2">
		<h2 class="text-lg font-medium text-content-primary">
			{content.lang.course.info}
		</h2>
		<div
			class="grid w-fit grid-flow-row grid-cols-[auto_auto] items-center gap-x-2 text-content-secondary"
		>
			<span>{content.lang.common.faculty}</span>
			<span>{course.faculty ?? content.lang.common.na}</span>
			<span>{content.lang.course.median}</span>
			<span>{course.median ?? content.lang.common.na}</span>
			<span>{content.lang.course.points}</span>
			<span>{course.points ?? content.lang.common.na}</span>
			<span>{content.lang.course.available}</span>
			<span>
				{course?.current ? content.lang.common.yes : content.lang.common.no}
			</span>
		</div>
	</div>

	<div class="mt-4">
		{#if dependencies.length !== 0}
			<div class="pb-4">
				<h2 class="ms-3 pb-1 text-lg font-medium text-content-primary">
					{content.lang.common.dependencies}
				</h2>
				<div
					bind:this={depRow}
					dir={content.lang.dir}
					class="flex flex-row overflow-x-auto"
				>
					<div class="me-3"></div>
					{#each dependencies as group, i}
						{#if i !== 0}
							<p
								class="flex flex-col justify-center pe-2 text-sm font-light text-content-secondary"
							>
								{content.lang.common.or}
							</p>
						{/if}
						<div class="flex flex-col space-y-1">
							{#each group.map(getCourseData) as dep}
								<a class="pe-2" href={`/course/${dep.code}`}>
									<CourseElement course={dep} />
								</a>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}
		{#if (course.connections?.adjacent ?? []).length !== 0}
			<div class="pb-4">
				<h2 class="ms-3 pb-1 text-lg font-medium text-content-primary">
					{content.lang.common.adjacencies}
				</h2>
				<div class="flex flex-row space-x-2 overflow-x-auto">
					<CourseRow resetScroll courses={course.connections?.adjacent ?? []}>
						{#snippet children({ course })}
							<a href={`/course/${course.code}`}>
								<CourseElement {course} />
							</a>
						{/snippet}
					</CourseRow>
				</div>
			</div>
		{/if}
		{#if (course.connections?.exclusive ?? []).length !== 0}
			<div class="pb-4">
				<h2 class="ms-3 pb-1 text-lg font-medium text-content-primary">
					{content.lang.common.exclusives}
				</h2>
				<CourseRow resetScroll courses={course.connections?.exclusive ?? []}>
					{#snippet children({ course })}
						<a href={`/course/${course.code}`}>
							<CourseElement {course} />
						</a>
					{/snippet}
				</CourseRow>
			</div>
		{/if}
		<div class="ms-3">
			{#if dependants.length > 0}
				<h2 class="pb-1 text-lg font-medium text-content-primary">
					{content.lang.common.dependants}
				</h2>
				<div class="flex flex-row flex-wrap">
					{#each dependants as c}
						<a class="pb-4 pe-2" href={`/course/${c.code}`}>
							<CourseElement course={c} />
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
