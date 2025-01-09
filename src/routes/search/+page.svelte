<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	import { content, user } from '$lib/stores.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import { getAllCourses } from '$lib/courseData';

	const query = $derived.by(() => {
		let q = (page.url.searchParams.get('q') ?? '').trim();

		// special case for backwards compatibility, convert 6 digit codes to 8 digit codes
		// first, check if q is all numbers
		const allNumbers = /^\d+$/.test(q);
		const isSixDigit = q.length === 6;
		if (allNumbers && isSixDigit) {
			const p1 = q.slice(0, 3);
			const p2 = q.slice(3);

			return `0${p1}0${p2}`;
		}

		return q;
	});
	const results = $derived(
		getAllCourses()
			.filter(({ name, code }) => name?.includes(query) || code.includes(query))
			.toSorted((a, b) => {
				return (b.median ?? 0) - (a.median ?? 0);
			})
	);

	function getCourseSemester(course: Course): number | undefined {
		const index = user.d.semesters.findIndex((s) => s.includes(course.code));

		if (index === -1) {
			return undefined;
		} else {
			return index;
		}
	}

	const seasonEmojis = ['❄️', '🌿', '☀️'];

	function formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}
</script>

<div class="m-3 me-0 text-content-primary">
	<h1 class="text-lg">
		{content.lang.search.resultsFor} "{query}"
	</h1>
	<p class="mb-3 text-xs text-content-secondary">
		{results.length}
		{content.lang.search.resultsFound}
	</p>
	<ul class="flex flex-row flex-wrap">
		{#each results as course, i}
			<li class="pb-4 pr-2">
				<button
					class:opacity-60={!course.current}
					onclick={() => goto(`/course/${course.code}`)}
				>
					<CourseElement {course}>
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
							{:else if user.d.exemptions.includes(course.code)}
								<span>✓</span>
								<span class="hidden sm:inline">
									{content.lang.catalog.exempt}
								</span>
							{:else if user.d.wishlist.includes(course.code)}
								<span>🌟</span>
								<span class="hidden sm:inline">
									{formatName(content.lang.catalog.wishlist)}
								</span>
							{/if}
						{/snippet}
					</CourseElement>
				</button>
			</li>
		{/each}
	</ul>
</div>
