<script lang="ts">
	import { goto } from '$app/navigation';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';

	import { user, content, setUser, writeStorage } from '$lib/stores.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { loadDegreeName } from '$lib/requirements.js';

	const { data } = $props();
	const { getCourseData } = $derived(data);

	async function importPlan() {
		if (user.d.semesters.length > 0) {
			const userConfirmation = confirm(content.lang.preview.overwriteWarning);

			if (!userConfirmation) {
				return;
			}
		}

		setUser(
			await writeStorage({
				...user.d,
				semesters: data.semesters as CourseCode[][],
				degree: data.degree,
				currentSemester: user.d.currentSemester ?? 0,
				wishlist: user.d.wishlist.filter(
					(c) => !data.semesters.flat().includes(c)
				)
			})
		);

		await goto('/plan');
	}

	function getDegreeName(degree: Degree, userPath?: string): Promise<string> {
		return loadDegreeName(
			content.lang.lang,
			content.lang.common.catalog,
			degree,
			userPath
		);
	}
</script>

<div class="mb-3 mt-3">
	<div class="mb-4 ms-3">
		<h1 class="mb-2 text-lg font-medium text-content-primary">
			{#await getDegreeName(data.degree, data.userPath)}
				<div class="h-7 w-7">
					<Spinner />
				</div>
			{:then name}
				{name}
			{/await}
		</h1>
		<AsyncButton variant="primary" onclick={importPlan}>
			{content.lang.preview.copy}
		</AsyncButton>
	</div>
	<div style="transform: rotateX(180deg)" class="overflow-x-auto">
		<div style="transform: rotateX(180deg)" class="flex flex-row">
			<div class="ms-3"></div>
			{#each data.semesters as semester, semesterIndex}
				<div class="pe-2" role="button" tabindex={semesterIndex}>
					<Semester
						{getCourseData}
						index={semesterIndex}
						{semester}
						isCurrent={false}
					>
						{#snippet children({ code, course })}
							<button
								class="touch-manipulation text-content-primary"
								onclick={() => goto(`/course/${code}`)}
							>
								<CourseElement {code} {course} squeeze={true} />
							</button>
						{/snippet}
					</Semester>
				</div>
			{/each}
			<div class="min-w-[1px]"></div>
		</div>
	</div>
</div>
