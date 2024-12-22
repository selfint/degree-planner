<script lang="ts">
	import type { Transcript } from '$lib/transcriptParser';
	import * as TranscriptParser from '$lib/transcriptParser';
	import { user, content, writeStorage, setUser } from '$lib/stores.svelte';
	import Button from '$lib/components/Button.svelte';
	import Semester from '$lib/components/Semester.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import { getCourseData } from '$lib/courseData';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import { goto } from '$app/navigation';
	import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let transcript: Transcript | undefined = $state(undefined);

	let { buttonNamespace = $bindable() } = $props();

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
				semesters: semesters,
				currentSemester: currentSemester,
				exemptions: transcript.exemptions
			})
		);

		await goto('/plan');
	}

	async function onCancel() {
		transcript = undefined;
	}

	let uploading = $state(false);
	async function handleFileUpload(event: unknown) {
		uploading = true;
		try {
			// @ts-expect-error
			const file = event.target.files[0];
			if (!file) return;

			const buffer = await file.arrayBuffer();

			const result = await TranscriptParser.parseTranscript(
				buffer,
				pdfWorkerUrl
			);
			if (result !== undefined) {
				transcript = result;
			}
		} finally {
			uploading = false;
		}
	}
</script>

<div>
	<h2 class="mb-2 ms-3 text-base font-medium text-content-primary">
		{content.lang.settings.upload}
	</h2>
	{#if transcript === undefined}
		<div class="mb-4 ms-3 flex w-fit flex-row gap-x-2">
			<div
				class="h-full cursor-pointer rounded-md border border-transparent bg-accent-primary p-0.5 pl-3 pr-3 leading-tight text-content-primary"
				class:opacity-50={uploading}
			>
				<label class="block h-full w-full cursor-pointer">
					{content.lang.settings.uploadLabel}
					<input
						type="file"
						disabled={uploading}
						accept="application/pdf"
						onchange={handleFileUpload}
						class="hidden"
					/>
				</label>
			</div>
			{#if uploading}
				<div class="h-7 w-7">
					<Spinner />
				</div>
			{/if}
		</div>
	{:else}
		<div class="mb-4 ms-3 flex w-fit flex-row gap-x-1">
			<div class="w-fit">
				<AsyncButton
					variant="primary"
					onclick={onSave}
					bind:buttonNamespace
					name="upload-save"
				>
					{content.lang.settings.save}
				</AsyncButton>
			</div>
			<div class="w-fit">
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
		<div class="mb-4">
			<h2 class="mb-2 ms-3 text-base font-medium text-content-primary">
				{content.lang.settings.exemptions}
			</h2>
			<CourseRow courses={transcript.exemptions}>
				{#snippet children({ course })}
					<CourseElement {course} />
				{/snippet}
			</CourseRow>
		</div>
		<div style="transform: rotateX(180deg)" class="overflow-x-auto">
			<div style="transform: rotateX(180deg)" class="flex flex-row">
				<div class="ms-3"></div>
				{#each transcript.semesters as semester, semesterIndex}
					<div class="pe-2" role="button" tabindex={semesterIndex}>
						<Semester
							index={semesterIndex}
							semester={semester.map(getCourseData)}
							isCurrent={semesterIndex === transcript.semesters.length - 1}
						>
							{#snippet children({ course })}
								<CourseElement {course} squeeze={true} />
							{/snippet}
						</Semester>
					</div>
				{/each}
				<div class="min-w-[1px]"></div>
			</div>
		</div>
	{/if}
</div>
