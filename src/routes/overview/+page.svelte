<script lang="ts">
	import {
		semesters,
		degreeData,
		currentSemester,
		wishlist,
		degreeProgress
	} from '$lib/stores';

	import { getCourseData } from '$lib/courseData';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import { getCourseLists } from '$lib/requirements';
	import { getProgress } from '$lib/progress';
	import { generateCourseColor } from '$lib/colors';
	import { goto } from '$app/navigation';
	import ScheduleError from './components/ScheduleError.svelte';

	function formatName(name: string | undefined): string | undefined {
		return name?.split('-').at(1);
	}

	function getAvgMedian(courses: Course[]): number {
		// @ts-expect-error
		const medians: number[] = courses
			.map((c) => c.median)
			.filter((m) => m !== undefined);

		return medians.length > 0
			? Math.round((medians.reduce((a, b) => a + b) / medians.length) * 10) / 10
			: 0;
	}

	function getStudyDays(courses: Course[], test: 0 | 1): [Course, number][] {
		// TODO: get semester end date and use it to calculate
		// the study days for the first test
		const fakeFirstStudyDays = 7;

		const courseTests = courses
			.map<[Course, Test | undefined]>(
				(c) => [c, c.tests?.[test]] as [Course, Test | undefined]
			)

			.filter<[Course, Test]>(
				// @ts-expect-error
				([_, t]) => t !== undefined
			)
			.map<[Course, Date]>(([c, t]) => [
				c,
				new Date(Date.UTC(t.year, t.monthIndex, t.day))
			])
			.toSorted((a, b) => a[1].getTime() - b[1].getTime());

		const firstCourse = courseTests[0]?.[0];
		let prevDate = courseTests.shift()?.[1];
		if (prevDate === undefined) {
			return [];
		}

		let courseStudyDays: [Course, number][] = [
			[firstCourse, fakeFirstStudyDays]
		];

		// get total count of days between tests
		// taking into account days, weeks, years
		for (const [course, test] of courseTests) {
			const diff = test.getTime() - prevDate.getTime();
			const days = Math.floor(diff / (1000 * 60 * 60 * 24));

			courseStudyDays.push([course, days]);

			prevDate = test;
		}

		return courseStudyDays;
	}

	function moveCourseToSemester(code: string, semester: number) {
		$wishlist = $wishlist.filter((c) => c !== code);
		$semesters = $semesters.map((s, i) =>
			i === semester ? [...new Set([...s, code])] : s.filter((c) => c !== code)
		);
		$degreeProgress = $degreeData?.then((data) =>
			getProgress($semesters, getCourseData, data.requirements)
		);
	}

	function moveCourseToWishlist(code: string) {
		$wishlist = [...new Set([...$wishlist, code])];
		$semesters = $semesters.map((s) => s.filter((c) => c !== code));
		$degreeProgress = $degreeData?.then((data) =>
			getProgress($semesters, getCourseData, data.requirements)
		);
	}
</script>

<div class="m-3">
	<div
		class="mb-4 min-h-[118px]"
		on:dragenter={(e) => {
			if (e.dataTransfer?.types.includes('text/x-course')) {
				e.preventDefault();
			}
		}}
		on:dragover|preventDefault={(e) => {
			if (e.dataTransfer !== null) {
				e.dataTransfer.dropEffect = 'move';
			}
		}}
		on:dragleave|preventDefault
		on:drop|preventDefault={(e) => {
			const code = e.dataTransfer?.getData('text/x-course');
			if (code !== undefined) {
				moveCourseToWishlist(code);
			}
		}}
		role="button"
		tabindex={0}
	>
		<h1 class="mb-2 text-2xl font-medium text-content-primary">Wish list</h1>
		<div class="flex flex-row space-x-2 overflow-x-auto">
			{#await Promise.all($wishlist.map(getCourseData)) then courses}
				{#each courses as course, i}
					<div
						class="container w-fit"
						draggable="true"
						tabindex={i}
						role="button"
						on:dragstart={(e) =>
							e.dataTransfer?.setData('text/x-course', course.code)}
						on:click={() => goto(`/course/${course.code}`)}
						on:keydown={(e) => {
							if (e.key === 'Enter') {
								goto(`/course/${course.code}`);
							}
						}}
					>
						<CourseElement
							{course}
							requirements={$degreeData?.then((d) =>
								getCourseLists(d.requirements, course.code)
							)}
						/>
					</div>
				{/each}
			{/await}
		</div>
	</div>
	<div class="flex flex-row space-x-3 overflow-x-auto">
		{#key $semesters.flat().join(' ')}
			{#each $semesters as semester, i}
				<div
					class="w-fit space-y-2"
					on:dragenter={(e) => {
						if (e.dataTransfer?.types.includes('text/x-course')) {
							e.preventDefault();
						}
					}}
					on:dragover|preventDefault={(e) => {
						if (e.dataTransfer !== null) {
							e.dataTransfer.dropEffect = 'move';
						}
					}}
					on:dragleave|preventDefault
					on:drop|preventDefault={(e) => {
						const code = e.dataTransfer?.getData('text/x-course');
						if (code !== undefined) {
							moveCourseToSemester(code, i);
						}
					}}
					role="button"
					tabindex={i}
				>
					<div class="w-[220px]" />
					<div class="flex min-w-full flex-row items-baseline justify-between">
						{#if i === $currentSemester}
							<h1
								class="border-b-2 border-b-accent-primary text-2xl font-medium text-content-primary"
							>
								{['Winter', 'Spring', 'Summer'][i % 3]}
								{Math.floor(i / 3) + 1}
							</h1>
						{:else}
							<h1
								class="border-b-2 border-b-transparent text-2xl font-medium text-content-primary"
							>
								{['Winter', 'Spring', 'Summer'][i % 3]}
								{Math.floor(i / 3) + 1}
							</h1>
						{/if}

						<div
							class="flex flex-row items-baseline justify-end space-x-1 text-content-secondary"
						>
							{#await Promise.all(semester.map(getCourseData)) then data}
								<span>
									{data
										.map((c) => c.tests)
										.filter((t) => t !== undefined && t.length > 0).length}
								</span>
								<span>
									{getAvgMedian(data)}
								</span>
								<span>
									{data.reduce((a, b) => a + (b.points ?? 0), 0)}
								</span>
							{/await}
						</div>
					</div>

					{#if i === $currentSemester}
						{#await Promise.all(semester.map(getCourseData)) then courses}
							<div class="w-full space-y-1">
								<div class="flex flex-row flex-wrap text-content-primary">
									{#each getStudyDays(courses, 0) as [course, days]}
										<div
											style="background: {generateCourseColor(course)}"
											class="mb-1 mr-0.5 w-6 p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
										>
											{days}
										</div>
									{/each}
								</div>
								<div
									class="flex w-full flex-row flex-wrap text-content-primary"
								>
									{#each getStudyDays(courses, 1) as [course, days]}
										<div
											style="background: {generateCourseColor(course)}"
											class="mb-1 mr-0.5 w-6 p-0 pb-0.5 pl-1 pr-1 pt-0.5 text-center text-xs leading-none"
										>
											{days}
										</div>
									{/each}
								</div>
							</div>
						{/await}
					{/if}

					<div class="flex w-[220px] flex-col space-y-2">
						{#each $semesters[i] as code, j}
							{#await getCourseData(code) then course}
								<div
									class="container rounded-md bg-card-secondary"
									draggable="true"
									tabindex={j}
									role="button"
									on:dragstart={(e) => {
										if (e.dataTransfer !== null) {
											e.dataTransfer.setData('text/x-course', code);
											e.dataTransfer.effectAllowed = 'move';
										}
									}}
									on:click={() => goto(`/course/${course.code}`)}
									on:keydown={(e) => {
										if (e.key === 'Enter') {
											goto(`/course/${course.code}`);
										}
									}}
								>
									<CourseElement
										{course}
										requirements={$degreeData?.then((d) =>
											getCourseLists(d.requirements, course.code)
										)}
									/>

									<div class="text-xs">
										<ScheduleError {course} index={i} semesters={$semesters}>
											<div
												slot="dep"
												let:course={dep}
												let:taken
												class="text-content-primary"
											>
												<div class="flex flex-row justify-between">
													<div>
														{#if taken}
															<span dir="rtl" class="line-through">
																{formatName(dep.name)}
															</span>
														{:else}
															<span dir="rtl">
																{formatName(dep.name)}
															</span>
														{/if}
														<span class="text-content-secondary">
															{dep.code}
														</span>
													</div>
													<div
														style="background: {generateCourseColor(dep)}"
														class="h-4 w-4 {dep.tests ? 'rounded-full' : ''}"
													/>
												</div>
											</div>
											<div
												slot="adj"
												let:course={adj}
												let:taken
												class="text-content-primary"
											>
												<div class="flex flex-row justify-between">
													<div>
														{#if taken}
															<span dir="rtl" class="line-through">
																{formatName(adj.name)}
															</span>
														{:else}
															<span dir="rtl">
																{formatName(adj.name)}
															</span>
														{/if}
														<span class="text-content-secondary">
															{adj.code}
														</span>
													</div>
													<div
														style="background: {generateCourseColor(adj)}"
														class="h-4 w-4 {adj.tests ? 'rounded-full' : ''}"
													/>
												</div>
											</div>
										</ScheduleError>
									</div>
								</div>
							{/await}
						{/each}
					</div>
				</div>
			{/each}
		{/key}
	</div>
</div>
