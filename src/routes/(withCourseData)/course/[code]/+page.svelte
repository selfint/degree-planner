<script lang="ts">
	import { page } from '$app/state';

	import CourseElement from '$lib/components/CourseElement.svelte';

	import {
		user,
		content,
		writeStorage,
		setUser,
		requirement
	} from '$lib/stores.svelte';

	import { getCourseLists, loadRequirement } from '$lib/requirements';
	import { generateColor } from '$lib/colors';
	import RequirementsElement from '$lib/components/RequirementsElement.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	const { data: pageData } = $props();
	const { getCourseData, courseData } = pageData;

	const code = $derived(page.params.code as CourseCode);
	const course = $derived(getCourseData(code));

	const courseMemberRequirements = $derived.by(async () => {
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
				exemptions: [...new Set([...user.d.exemptions, code])] as CourseCode[]
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
				wishlist: [...new Set([...user.d.wishlist, code])] as CourseCode[]
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

	function getCourseSemester(code: CourseCode): number | undefined {
		const index = user.d.semesters.findIndex((s) => s.includes(code));

		if (index === -1) {
			return undefined;
		} else {
			return index;
		}
	}
</script>

<div class="mt-3">
	<h1 class="ms-3 text-lg font-medium text-content-primary">
		<div class="flex flex-row flex-wrap items-center gap-x-1 leading-tight">
			<div class="m-0 mb-1 mt-1 p-0">
				<div
					style="background: {generateColor(code)}"
					class="h-4 w-4 rounded-full"
				></div>
			</div>
			<span dir="rtl">
				{#await course}
					{code}
				{:then course}
					{course.name ?? code}
				{/await}
			</span>

			<a
				href={`https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2024/201/SM/${code}`}
				target="_blank"
			>
				<span class="text-content-secondary">
					{code}
				</span>
			</a>
		</div>
	</h1>

	{#await course}
		<div class="mb-4 ml-3 mr-3 mt-3 h-5 w-5">
			<Spinner />
		</div>
	{:then course}
		<p class="mb-4 ml-3 mr-3 mt-3 text-content-secondary" dir="rtl">
			{course.about}
		</p>
	{/await}

	<div class="ml-3 mr-3 flex flex-row items-center gap-x-1">
		{#if courseState === 'planned'}
			<AsyncButton
				variant="secondary"
				onclick={removeCourseFromSemesters}
				bind:buttonNamespace
				name="un-plan"
			>
				{content.lang.course.removeFromSemester}
				{getSeasonAndIndex(user.d.semesters.findIndex((s) => s.includes(code)))}
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

	{#if courseMemberRequirements !== undefined}
		<div class="ms-3 mt-4">
			{#await courseMemberRequirements}
				<h2 class="text-lg font-medium text-content-primary">
					{content.lang.course.appliesTo}
					<div class="inline-block h-5 w-5">
						<Spinner />
					</div>
				</h2>
			{:then courseMemberRequirements}
				<h2 class="text-lg font-medium text-content-primary">
					{content.lang.course.appliesTo}
				</h2>
				<div class="text-content-secondary">
					<RequirementsElement requirements={courseMemberRequirements} />
				</div>
			{/await}
		</div>
	{/if}
	{#await course}
		<div class="ms-3 mt-2">
			<h2 class="text-lg font-medium text-content-primary">
				{content.lang.course.info}
				<div class="inline-block h-5 w-5">
					<Spinner />
				</div>
			</h2>
			<div
				class="grid w-fit grid-flow-row grid-cols-[auto_auto] items-center gap-x-2 text-content-secondary"
			>
				<span>{content.lang.common.faculty}</span>
				<span></span>
				<span>{content.lang.course.median}</span>
				<span></span>
				<span>{content.lang.course.points}</span>
				<span></span>
				<span>{content.lang.course.available}</span>
				<span></span>
			</div>
		</div>
	{:then course}
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
			{#if dependencies(course).length !== 0}
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
						{#each dependencies(course) as group, i}
							{#if i !== 0}
								<p
									class="flex flex-col justify-center pe-2 text-sm font-light text-content-secondary"
								>
									{content.lang.common.or}
								</p>
							{/if}
							<div class="flex flex-col space-y-1">
								{#each group as code}
									<a class="pe-2" href={`/course/${code}`}>
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
												{:else if user.d.exemptions.includes(code)}
													<span>✓</span>
													<span class="hidden sm:inline">
														{content.lang.catalog.exempt}
													</span>
												{:else if user.d.wishlist.includes(code)}
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
				</div>
			{/if}
			{#if (course.connections?.adjacent ?? []).length !== 0}
				<div class="pb-4">
					<h2 class="ms-3 pb-1 text-lg font-medium text-content-primary">
						{content.lang.common.adjacencies}
					</h2>
					<div class="flex flex-row space-x-2 overflow-x-auto">
						<CourseRow
							{getCourseData}
							resetScroll
							courses={course.connections?.adjacent ?? []}
						>
							{#snippet children({ code, course })}
								<a href={`/course/${code}`}>
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
											{:else if user.d.exemptions.includes(code)}
												<span>✓</span>
												<span class="hidden sm:inline">
													{content.lang.catalog.exempt}
												</span>
											{:else if user.d.wishlist.includes(code)}
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
				</div>
			{/if}
			{#if (course.connections?.exclusive ?? []).length !== 0}
				<div class="pb-4">
					<h2 class="ms-3 pb-1 text-lg font-medium text-content-primary">
						{content.lang.common.exclusives}
					</h2>
					<CourseRow
						{getCourseData}
						resetScroll
						courses={course.connections?.exclusive ?? []}
					>
						{#snippet children({ code, course })}
							<a href={`/course/${code}`}>
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
										{:else if user.d.exemptions.includes(code)}
											<span>✓</span>
											<span class="hidden sm:inline">
												{content.lang.catalog.exempt}
											</span>
										{:else if user.d.wishlist.includes(code)}
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
			{/if}

			<div class="ms-3">
				{#await dependants then dependants}
					{#if dependants.length > 0}
						<h2 class="pb-1 text-lg font-medium text-content-primary">
							{content.lang.common.dependants}
						</h2>
						<div class="flex flex-row flex-wrap">
							{#each dependants as course}
								<a class="pb-4 pe-2" href={`/course/${course.code}`}>
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
											{:else if user.d.exemptions.includes(course.code)}
												<span>✓</span>
												<span class="hidden sm:inline">
													{content.lang.catalog.exempt}
												</span>
											{:else if user.d.wishlist.includes(course.code)}
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
