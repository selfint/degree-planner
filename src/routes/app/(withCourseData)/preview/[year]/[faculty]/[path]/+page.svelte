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
				path: data.userPath,
				currentSemester: user.d.currentSemester ?? 0,
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

<div class="ui-page preview-page">
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
	{#if data.semesters.length === 0}
		<p class="ui-panel preview-empty">
			{content.lang.lang === 'he'
				? 'אין סמסטרים בתוכנית זו.'
				: 'This plan has no semesters yet.'}
		</p>
	{:else}
		<p class="preview-scroll-hint">
			{content.lang.lang === 'he'
				? 'גללו לצדדים כדי לראות את כל הסמסטרים בתוכנית.'
				: 'Scroll horizontally to view all semesters in this plan.'}
		</p>
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
		min-inline-size: 0;
	}

	.preview-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.25rem 2rem;
		margin-block-end: 1.5rem;
	}

	.preview-heading {
		max-inline-size: 52rem;
		min-inline-size: 0;
		overflow-wrap: anywhere;
	}

	.preview-eyebrow {
		margin-block-end: 0.5rem;
		color: rgb(var(--color-content-secondary));
		font-size: 0.875rem;
		font-weight: 500;
	}

	.preview-actions {
		flex-shrink: 0;
	}

	.preview-loading {
		display: inline-block;
		inline-size: 1.5rem;
		block-size: 1.5rem;
	}

	.preview-scroll-hint {
		margin-block-end: 1rem;
		color: rgb(var(--color-content-secondary));
		font-size: 0.875rem;
	}

	.preview-semesters {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		overflow-x: auto;
		overscroll-behavior-inline: contain;
		scroll-snap-type: inline proximity;
		scroll-padding-inline: 0.25rem;
		padding: 0.25rem 0.25rem 1rem;
		margin-inline: -0.25rem;
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
		padding: 1.25rem;
		color: rgb(var(--color-content-secondary));
	}

	.preview-semesters:focus-visible {
		outline: 0.125rem solid rgb(var(--color-accent-primary));
		outline-offset: 0.1875rem;
		border-radius: 0.5rem;
	}

	@media (max-width: 40rem) {
		.preview-header {
			flex-direction: column;
			align-items: stretch;
		}

		.preview-actions :global(button) {
			inline-size: 100%;
		}
	}
</style>
