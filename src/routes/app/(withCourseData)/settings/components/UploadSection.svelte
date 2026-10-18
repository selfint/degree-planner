<script lang="ts">
	import { isPlanWritable, planOnline } from '$lib/planAccess';
	import type { Transcript } from '$lib/transcriptParser';
	import * as TranscriptParser from '$lib/transcriptParser';
	import { user, content, writeStorage, setUser } from '$lib/stores.svelte';
	import Semester from '$lib/components/Semester.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import { goto } from '$app/navigation';
	import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import PlanActionButton from '$lib/components/PlanActionButton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let transcript: Transcript | undefined = $state(undefined);

	let { getCourseData, buttonNamespace = $bindable() } = $props();

	async function onSave() {
		if (transcript === undefined) {
			return;
		}

		const currentSemester = transcript.semesters.length - 1;

		const semesters = [...transcript.semesters];
		while (semesters.length < 9) {
			semesters.push([]);
		}

		setUser(
			await writeStorage({
				...user.d,
				semesters: semesters as CourseCode[][],
				currentSemester: currentSemester,
				exemptions: transcript.exemptions as CourseCode[]
			})
		);

		await goto('/app/plan');
	}

	async function onCancel() {
		transcript = undefined;
	}

	let uploading = $state(false);
	async function handleFileUpload(event: unknown) {
		if (!isPlanWritable()) return;
		uploading = true;
		try {
			// @ts-expect-error
			const file = event.target.files[0];
			if (!file) return;

			const buffer = await file.arrayBuffer();

			const result = await TranscriptParser.parseTranscript(
				getCourseData,
				buffer,
				pdfWorkerUrl
			);
			if (result !== undefined && isPlanWritable()) {
				transcript = result;
			}
		} finally {
			uploading = false;
		}
	}
</script>

<section class="upload-section">
	<h2 class="section-title">{content.lang.settings.upload}</h2>
	{#if transcript === undefined}
		<div class="upload-field">
			<div class="upload-actions">
				<label
					class="ui-button ui-button--primary upload-trigger"
					class:upload-disabled={uploading || !$planOnline}
				>
					{content.lang.settings.uploadLabel}
					<input
						type="file"
						disabled={uploading || !$planOnline}
						accept="application/pdf"
						onchange={handleFileUpload}
					/>
				</label>
				{#if uploading}
					<span class="upload-status" role="status">
						<span class="h-5 w-5 shrink-0" aria-hidden="true"><Spinner /></span>
						<span>{content.lang.common.loading}</span>
					</span>
				{/if}
			</div>
		</div>
	{:else}
		<div class="preview-header">
			<h3 class="preview-title">{content.lang.settings.preview}</h3>
			<div class="upload-actions">
				<PlanActionButton
					variant="primary"
					onclick={onSave}
					bind:buttonNamespace
					name="upload-save"
				>
					{content.lang.settings.save}
				</PlanActionButton>
				<AsyncButton
					variant="secondary"
					onclick={onCancel}
					bind:buttonNamespace
					name="upload-cancel"
				>
					{content.lang.settings.cancel}
				</AsyncButton>
			</div>
		</div>
		<div class="preview-exemptions">
			<h3 class="preview-title">{content.lang.settings.exemptions}</h3>
			<CourseRow {getCourseData} courses={transcript.exemptions} indent={0}>
				{#snippet children({ code, course })}
					<CourseElement {code} {course} />
				{/snippet}
			</CourseRow>
		</div>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this horizontal transcript preview to scroll it.) -->
		<div
			style="transform: rotateX(180deg)"
			class="preview-scroll overflow-x-auto"
			role="region"
			aria-label={`${content.lang.settings.preview}: ${content.lang.common.semester}`}
			tabindex="0"
		>
			<div style="transform: rotateX(180deg)" class="flex flex-row gap-3">
				{#each transcript.semesters as semester, semesterIndex}
					<div>
						<Semester
							{getCourseData}
							index={semesterIndex}
							{semester}
							isCurrent={semesterIndex === transcript.semesters.length - 1}
						>
							{#snippet children({ code, course })}
								<CourseElement {code} {course} squeeze={true} />
							{/snippet}
						</Semester>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</section>

<style>
	.upload-section {
		min-inline-size: 0;
		padding-block-start: 0.75rem;
		text-align: start;
	}
	.section-title {
		margin-block-end: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.4;
	}
	.upload-field {
		display: grid;
		gap: 0.5rem;
	}
	.upload-actions,
	.upload-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.upload-actions {
		flex-wrap: wrap;
	}
	.upload-status {
		color: rgb(var(--color-content-secondary));
		font-size: 0.8125rem;
	}
	.upload-trigger {
		position: relative;
		cursor: pointer;
	}
	.upload-trigger:focus-within {
		outline: 0.125rem solid rgb(var(--color-accent-primary));
		outline-offset: 0.1875rem;
	}
	.upload-trigger input {
		position: absolute;
		inset: 0;
		inline-size: 100%;
		block-size: 100%;
		opacity: 0;
		cursor: pointer;
	}
	.upload-disabled,
	.upload-disabled input {
		cursor: not-allowed;
	}
	.upload-disabled {
		opacity: 0.45;
	}
	.preview-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-block-end: 0.75rem;
	}
	.preview-title {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.preview-scroll:focus-visible {
		outline: 0.125rem solid rgb(var(--color-accent-primary));
		outline-offset: 0.1875rem;
	}
	.preview-exemptions {
		display: grid;
		gap: 0.5rem;
		margin-block-end: 0.75rem;
	}
</style>
