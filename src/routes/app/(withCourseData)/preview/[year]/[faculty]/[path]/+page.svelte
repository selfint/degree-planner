<script lang="ts">
	import { goto } from '$app/navigation';

	import CourseElement from '$lib/components/CourseElement.svelte';
	import Semester from '$lib/components/Semester.svelte';

	import { user, content, setUser, writeStorage } from '$lib/stores.svelte';
	import PlanActionButton from '$lib/components/PlanActionButton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { loadDegreeName } from '$lib/requirements.js';

	const { data } = $props();
	const { getCourseData } = $derived(data);

	let importError = $state(false);

	async function importPlan() {
		importError = false;
		const currentSemester = user.d.currentSemester;
		// Import replaces the semester list, but the receiver chooses Current.
		// Reject before confirmation or any write rather than silently changing it.
		if (
			!Number.isInteger(currentSemester) ||
			currentSemester < 0 ||
			currentSemester >= data.semesters.length
		) {
			importError = true;
			return;
		}
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
				path: data.userPath,
				currentSemester,
				wishlist: user.d.wishlist.filter(
					(c) => !data.semesters.flat().includes(c)
				)
			})
		);

		await goto('/app/plan');
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

<div class="preview-page">
	<header class="preview-header">
		<div class="preview-heading">
			<p class="preview-eyebrow">{content.lang.settings.preview}</p>
			<h1 class="ui-page-title">
				{#await getDegreeName(data.degree, data.userPath)}
					<span
						class="preview-loading"
						role="status"
						aria-label={content.lang.common.loading}><Spinner /></span
					>
				{:then name}
					{name}
				{/await}
			</h1>
		</div>
		<div class="preview-actions">
			<PlanActionButton variant="primary" onclick={importPlan}>
				{content.lang.preview.copy}
			</PlanActionButton>
		</div>
	</header>
	{#if importError}
		<p role="alert" class="preview-empty" data-testid="preview-import-error">
			{#if data.semesters.length === 0}
				{content.lang.lang === 'he'
					? 'אין סמסטרים להעתקה בתוכנית המשותפת הזו.'
					: 'This shared plan has no semesters to copy.'}
			{:else}
				{content.lang.lang === 'he'
					? 'בחרו ושמרו סמסטר נוכחי תקין ב'
					: 'Choose and save a valid current semester in'}
				<a href="/app/settings" class="underline"
					>{content.lang.landing.settings.header}</a
				>.
				{content.lang.lang === 'he'
					? 'לאחר מכן חזרו והעתיקו את התוכנית שוב.'
					: 'Then return and copy this plan again.'}
			{/if}
		</p>
	{/if}
	{#if data.semesters.length === 0}
		<p class="preview-empty">
			{content.lang.lang === 'he' ? 'אין סמסטרים' : 'No semesters'}
		</p>
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this region to scroll through the semesters.) -->
		<div
			class="preview-semesters"
			role="region"
			aria-label={content.lang.common.semester}
			tabindex="0"
		>
			{#each data.semesters as semester, semesterIndex}
				<div class="preview-semester">
					<Semester
						{getCourseData}
						index={semesterIndex}
						{semester}
						isCurrent={false}
					>
						{#snippet children({ code, course })}
							<a class="preview-course" href={`/app/course/${code}`}>
								<CourseElement {code} {course} squeeze={true} />
							</a>
						{/snippet}
					</Semester>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.preview-page {
		inline-size: 100%;
		min-inline-size: 0;
		padding-block: 0.625rem;
	}
	.preview-header,
	.preview-empty {
		margin-inline: 0.75rem;
	}
	.preview-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		margin-block-end: 0.75rem;
	}
	.preview-heading {
		max-inline-size: 52rem;
		min-inline-size: 0;
		overflow-wrap: anywhere;
	}
	.preview-eyebrow {
		color: rgb(var(--color-content-secondary));
		font-size: 0.75rem;
	}
	.preview-actions {
		flex-shrink: 0;
	}
	.preview-loading {
		display: inline-block;
		inline-size: 1.25rem;
		block-size: 1.25rem;
	}
	.preview-semesters {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		overflow-x: auto;
		overscroll-behavior-inline: contain;
		scroll-snap-type: inline proximity;
		scroll-padding-inline: 0.75rem;
		padding-block: 0.25rem 0.625rem;
		padding-inline: 0.75rem;
		scrollbar-color: rgb(var(--color-content-secondary) / 0.4) transparent;
	}
	.preview-semester {
		flex-shrink: 0;
		scroll-snap-align: start;
	}
	.preview-course {
		display: block;
		touch-action: manipulation;
		border-radius: var(--radius-card);
	}
	.preview-empty {
		color: rgb(var(--color-content-secondary));
		font-size: 0.875rem;
	}
	.preview-semesters:focus-visible {
		outline: 0.125rem solid rgb(var(--color-accent-primary));
		outline-offset: 0.1875rem;
		border-radius: 0.25rem;
	}
</style>
