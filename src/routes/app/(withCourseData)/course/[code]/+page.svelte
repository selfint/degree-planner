<script lang="ts">
	import { page } from '$app/state';
	import { getContext } from 'svelte';
	import { PERSONAL_PLAN_READY } from '$lib/pwa/plan-visibility';
	import { pwaMessages } from '$lib/pwa/messages';
	const personalPlanReady =
		getContext<() => boolean>(PERSONAL_PLAN_READY) ?? (() => false);
	const showPersonalPlan = $derived(personalPlanReady());

	import CourseElement from '$lib/components/CourseElement.svelte';

	import {
		user,
		content,
		writeStorage,
		setUser,
		requirement
	} from '$lib/stores.svelte';

	import { getCourseLists } from '$lib/requirements';
	import RequirementsElement from '$lib/components/RequirementsElement.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import PlanActionButton from '$lib/components/PlanActionButton.svelte';
	import { planOnline } from '$lib/planAccess';
	import Spinner from '$lib/components/Spinner.svelte';

	const { data: pageData } = $props();
	const { getCourseData, courseData } = $derived(pageData);
	const course = $derived.by(() => pageData.course);

	const code = $derived(page.params.code as CourseCode);

	const courseMemberRequirements = $derived.by(async () => {
		if (!showPersonalPlan) return [];
		const r = requirement();
		if (r === undefined) {
			return [];
		}

		return getCourseLists(await r, code);
	});

	const seasonEmojis = ['❄️', '🌿', '☀️'];

	const dependencies = (course: Course) =>
		course.connections?.dependencies.filter((g) => g.length > 0) ?? [];

	const dependants = $derived(
		courseData.then((courseData) =>
			Object.values(courseData)
				.filter((c) =>
					(c.connections?.dependencies ?? []).some((group) =>
						group.includes(code as CourseCode)
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
		)
	);

	let buttonNamespace = $state('');

	async function planCourse(): Promise<void> {
		if (!personalPlanReady()) return;
		setUser(
			await writeStorage({
				...user.d,
				semesters: user.d.semesters.map((s, i) =>
					i === user.d.currentSemester ? [...new Set([...s, code])] : s
				) as CourseCode[][],
				wishlist: user.d.wishlist.filter((c) => c !== code)
			})
		);
	}

	async function removeCourseFromSemesters(): Promise<void> {
		if (!personalPlanReady()) return;
		setUser(
			await writeStorage({
				...user.d,
				semesters: user.d.semesters.map((s) => s.filter((c) => c !== code))
			})
		);
	}

	async function addCourseToExemptions(): Promise<void> {
		if (!personalPlanReady()) return;
		setUser(
			await writeStorage({
				...user.d,
				exemptions: [...new Set([...user.d.exemptions, code])] as CourseCode[]
			})
		);
	}

	async function removeCourseFromExemptions(): Promise<void> {
		if (!personalPlanReady()) return;
		setUser(
			await writeStorage({
				...user.d,
				exemptions: user.d.exemptions.filter((c) => c !== code)
			})
		);
	}

	async function addCourseToWishlist(): Promise<void> {
		if (!personalPlanReady()) return;
		setUser(
			await writeStorage({
				...user.d,
				wishlist: [...new Set([...user.d.wishlist, code])] as CourseCode[]
			})
		);
	}

	async function removeCourseFromWishlist(): Promise<void> {
		if (!personalPlanReady()) return;
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
		if (!showPersonalPlan) return 'none';
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

	function getCourseSemester(code: CourseCode): number | undefined {
		if (!showPersonalPlan) return undefined;
		const index = user.d.semesters.findIndex((s) => s.includes(code));

		if (index === -1) {
			return undefined;
		} else {
			return index;
		}
	}
</script>

<div class="ui-page course-page">
	<header class="course-header">
		<div class="course-title-row">
			<a
				class="course-code"
				href={`https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2024/201/SM/${code}`}
				target="_blank"
				rel="noreferrer"
				aria-label={content.lang.lang === 'he'
					? `פתיחת קורס ${code} ב-SAP (בלשונית חדשה)`
					: `Open course ${code} in SAP (new tab)`}
			>
				<bdi dir="ltr">{code}</bdi>
				<span aria-hidden="true">↗</span>
			</a>
			<h1 class="ui-page-title course-name">
				{#await course}
					<bdi dir="ltr">{code}</bdi>
				{:then course}
					<bdi dir="auto">{course.name ?? code}</bdi>
				{/await}
			</h1>
		</div>
	</header>

	{#if showPersonalPlan}
		<div class="course-actions" data-testid="course-plan-actions">
			{#if courseState === 'planned'}
				<PlanActionButton
					showOfflineReason={false}
					variant="secondary"
					onclick={removeCourseFromSemesters}
					bind:buttonNamespace
					name="un-plan"
				>
					{content.lang.course.removeFromSemester}
					{getSeasonAndIndex(
						user.d.semesters.findIndex((s) => s.includes(code))
					)}
				</PlanActionButton>
			{:else}
				<PlanActionButton
					showOfflineReason={false}
					variant="primary"
					onclick={planCourse}
					bind:buttonNamespace
					name="plan"
				>
					{content.lang.course.plan}
				</PlanActionButton>
				{#if courseState === 'wished'}
					<PlanActionButton
						showOfflineReason={false}
						variant="secondary"
						onclick={removeCourseFromWishlist}
						bind:buttonNamespace
						name="un-wish"
					>
						{content.lang.course.removeFromWishlist}
					</PlanActionButton>
				{:else if courseState === 'exempt'}
					<PlanActionButton
						showOfflineReason={false}
						variant="secondary"
						onclick={removeCourseFromExemptions}
						bind:buttonNamespace
						name="un-exempt"
					>
						{content.lang.course.removeFromExemption}
					</PlanActionButton>
				{:else}
					<PlanActionButton
						showOfflineReason={false}
						variant="secondary"
						onclick={addCourseToWishlist}
						bind:buttonNamespace
						name="wish"
					>
						{content.lang.course.wishlist}
					</PlanActionButton>
					<PlanActionButton
						showOfflineReason={false}
						variant="secondary"
						onclick={addCourseToExemptions}
						bind:buttonNamespace
						name="exempt"
					>
						{content.lang.course.exempt}
					</PlanActionButton>
				{/if}
			{/if}
			{#if !$planOnline}
				<span class="course-offline" role="status"
					>{content.lang.lang === 'he' ? 'ללא אינטרנט' : 'Offline'}</span
				>
			{/if}
		</div>
	{:else}
		<p
			role="status"
			class="ui-notice course-notice"
			data-testid="course-plan-unavailable"
		>
			{pwaMessages[content.lang.lang].courseActionsUnavailable}
		</p>
	{/if}

	{#await course}
		<section class="course-details-panel">
			<h2 class="sr-only">{content.lang.course.info}</h2>
			<div
				class="course-loading"
				role="status"
				aria-label={content.lang.common.loading}
			>
				<Spinner />
			</div>
		</section>
	{:then course}
		<section class="course-details-panel">
			<h2 class="sr-only">{content.lang.course.info}</h2>
			<dl class="course-metadata">
				<div>
					<dt>{content.lang.common.faculty}</dt>
					<dd>
						<bdi dir="auto">{course.faculty ?? content.lang.common.na}</bdi>
					</dd>
				</div>
				<div>
					<dt>{content.lang.course.median}</dt>
					<dd>{course.median ?? content.lang.common.na}</dd>
				</div>
				<div>
					<dt>{content.lang.course.points}</dt>
					<dd>{course.points ?? content.lang.common.na}</dd>
				</div>
				<div>
					<dt>{content.lang.course.available}</dt>
					<dd>
						{course.current ? content.lang.common.yes : content.lang.common.no}
					</dd>
				</div>
			</dl>
		</section>

		{#if course.about}
			<details class="course-description">
				<summary
					>{content.lang.lang === 'he'
						? 'תיאור הקורס'
						: 'Course description'}</summary
				>
				<p><bdi dir="auto">{course.about}</bdi></p>
			</details>
		{/if}

		{#if showPersonalPlan}
			{#await courseMemberRequirements then memberships}
				{#if memberships.length > 0}
					<section class="course-details-panel">
						<h2 class="course-section-title">
							{content.lang.course.appliesTo}
						</h2>
						<div class="text-content-secondary">
							<RequirementsElement requirements={memberships} />
						</div>
					</section>
				{/if}
			{/await}
		{/if}

		<div class="course-relations">
			{#if dependencies(course).length !== 0}
				<section class="course-relation-group">
					<h2 class="course-section-title">
						{content.lang.common.dependencies}
					</h2>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this region to scroll through the course dependencies.) -->
					<div
						bind:this={depRow}
						dir={content.lang.dir}
						class="course-dependencies"
						role="region"
						aria-label={content.lang.common.dependencies}
						tabindex="0"
					>
						{#each dependencies(course) as group, i}
							{#if i !== 0}
								<p
									class="flex flex-col justify-center text-sm text-content-secondary"
								>
									{content.lang.common.or}
								</p>
							{/if}
							<div class="flex shrink-0 flex-col gap-2">
								{#each group as code}
									<a href={`/app/course/${code}`}>
										<CourseElement {code} course={getCourseData(code)}>
											{#snippet note()}
												{@const index = getCourseSemester(code)}
												{#if index !== undefined}
													<span>
														{seasonEmojis[index % 3]}
														<span class="hidden sm:inline">
															{content.lang.common.seasons[index % 3]}
															{Math.floor(index / 3) + 1}
														</span>
													</span>
												{:else if showPersonalPlan && user.d.exemptions.includes(code)}
													<span>✓</span>
													<span class="hidden sm:inline">
														{content.lang.catalog.exempt}
													</span>
												{:else if showPersonalPlan && user.d.wishlist.includes(code)}
													<span>🌟</span>
													<span class="hidden sm:inline">
														{content.lang.catalog.wishlist}
													</span>
												{/if}
											{/snippet}
										</CourseElement>
									</a>
								{/each}
							</div>
						{/each}
					</div>
				</section>
			{/if}
			{#if (course.connections?.adjacent ?? []).length !== 0}
				<section class="course-relation-group">
					<h2 class="course-section-title">
						{content.lang.common.adjacencies}
					</h2>
					<div class="min-w-0">
						<CourseRow
							indent={0}
							{getCourseData}
							resetScroll
							courses={course.connections?.adjacent ?? []}
						>
							{#snippet children({ code, course })}
								<a href={`/app/course/${code}`}>
									<CourseElement {code} {course}>
										{#snippet note()}
											{@const index = getCourseSemester(code)}
											{#if index !== undefined}
												<span>
													{seasonEmojis[index % 3]}
													<span class="hidden sm:inline">
														{content.lang.common.seasons[index % 3]}
														{Math.floor(index / 3) + 1}
													</span>
												</span>
											{:else if showPersonalPlan && user.d.exemptions.includes(code)}
												<span>✓</span>
												<span class="hidden sm:inline">
													{content.lang.catalog.exempt}
												</span>
											{:else if showPersonalPlan && user.d.wishlist.includes(code)}
												<span>🌟</span>
												<span class="hidden sm:inline">
													{content.lang.catalog.wishlist}
												</span>
											{/if}
										{/snippet}
									</CourseElement>
								</a>
							{/snippet}
						</CourseRow>
					</div>
				</section>
			{/if}
			{#if (course.connections?.exclusive ?? []).length !== 0}
				<section class="course-relation-group">
					<h2 class="course-section-title">
						{content.lang.common.exclusives}
					</h2>
					<CourseRow
						indent={0}
						{getCourseData}
						resetScroll
						courses={course.connections?.exclusive ?? []}
					>
						{#snippet children({ code, course })}
							<a href={`/app/course/${code}`}>
								<CourseElement {code} {course}>
									{#snippet note()}
										{@const index = getCourseSemester(code)}
										{#if index !== undefined}
											<span>
												{seasonEmojis[index % 3]}
												<span class="hidden sm:inline">
													{content.lang.common.seasons[index % 3]}
													{Math.floor(index / 3) + 1}
												</span>
											</span>
										{:else if showPersonalPlan && user.d.exemptions.includes(code)}
											<span>✓</span>
											<span class="hidden sm:inline">
												{content.lang.catalog.exempt}
											</span>
										{:else if showPersonalPlan && user.d.wishlist.includes(code)}
											<span>🌟</span>
											<span class="hidden sm:inline">
												{content.lang.catalog.wishlist}
											</span>
										{/if}
									{/snippet}
								</CourseElement>
							</a>
						{/snippet}
					</CourseRow>
				</section>
			{/if}

			<div class="course-relation-group">
				{#await dependants then dependants}
					{#if dependants.length > 0}
						<h2 class="course-section-title">
							{content.lang.common.dependants}
						</h2>
						<div class="flex flex-wrap gap-2">
							{#each dependants as course}
								<a href={`/app/course/${course.code}`}>
									<CourseElement code={course.code} {course}>
										{#snippet note()}
											{@const index = getCourseSemester(course.code)}
											{#if index !== undefined}
												<span>
													{seasonEmojis[index % 3]}
													<span class="hidden sm:inline">
														{content.lang.common.seasons[index % 3]}
														{Math.floor(index / 3) + 1}
													</span>
												</span>
											{:else if showPersonalPlan && user.d.exemptions.includes(course.code)}
												<span>✓</span>
												<span class="hidden sm:inline">
													{content.lang.catalog.exempt}
												</span>
											{:else if showPersonalPlan && user.d.wishlist.includes(course.code)}
												<span>🌟</span>
												<span class="hidden sm:inline">
													{content.lang.catalog.wishlist}
												</span>
											{/if}
										{/snippet}
									</CourseElement>
								</a>
							{/each}
						</div>
					{/if}
				{/await}
			</div>
		</div>
	{/await}
</div>

<style>
	.course-page {
		display: grid;
		gap: 0.75rem;
	}
	.course-header {
		max-inline-size: 56rem;
	}
	.course-title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.625rem;
	}
	.course-code {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-block-size: 2rem;
		color: rgb(var(--color-link));
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}
	.course-code:hover {
		text-decoration: underline;
	}
	.course-name {
		overflow-wrap: anywhere;
		text-align: start;
	}
	.course-description {
		max-inline-size: 56rem;
		font-size: 0.875rem;
		text-align: start;
	}
	.course-description summary {
		width: fit-content;
		padding-block: 0.375rem;
		cursor: pointer;
	}
	.course-description summary:focus-visible {
		outline: 0.125rem solid rgb(var(--color-accent-primary));
		outline-offset: 0.125rem;
	}
	.course-description p {
		padding-block: 0.25rem;
		color: rgb(var(--color-content-secondary));
		line-height: 1.6;
	}
	.course-loading {
		inline-size: 1.25rem;
		block-size: 1.25rem;
	}
	.course-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.course-actions :global(.plan-action) {
		max-inline-size: 100%;
	}
	.course-offline {
		flex-basis: 100%;
		color: rgb(var(--color-content-secondary));
		font-size: 0.75rem;
	}

	.course-actions :global(button) {
		max-inline-size: 100%;
		white-space: normal;
	}
	.course-notice {
		margin: 0;
	}
	.course-details-panel {
		min-inline-size: 0;
	}
	.course-section-title {
		margin-block-end: 0.375rem;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.4;
	}
	.course-metadata {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem 1rem;
		padding-block: 0.625rem;
		border-block: 1px solid rgb(var(--color-border));
		font-size: 0.875rem;
	}
	.course-metadata > div:first-child {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.5rem;
		align-items: baseline;
	}
	.course-metadata dt {
		color: rgb(var(--color-content-secondary));
		font-size: 0.75rem;
	}
	.course-metadata dd {
		font-weight: 500;
		overflow-wrap: anywhere;
	}
	.course-relations {
		display: grid;
		gap: 0.875rem;
		min-inline-size: 0;
	}
	.course-relation-group {
		min-inline-size: 0;
	}
	.course-dependencies {
		display: flex;
		gap: 0.625rem;
		overflow-x: auto;
		padding: 0.25rem 0.25rem 0.5rem;
		margin-inline: -0.25rem;
		overscroll-behavior-inline: contain;
	}
	.course-dependencies:focus-visible {
		outline: 0.125rem solid rgb(var(--color-accent-primary));
		outline-offset: 0.1875rem;
		border-radius: 0.25rem;
	}
	@media (min-width: 48rem) {
		.course-metadata {
			grid-template-columns: 2fr repeat(3, minmax(0, 1fr));
		}
		.course-metadata > div:first-child {
			grid-column: auto;
			display: block;
		}
	}
</style>
