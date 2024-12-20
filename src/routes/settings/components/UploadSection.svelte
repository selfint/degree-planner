<script lang="ts">
	import type { Transcript } from '$lib/transcriptParser';
	import * as TranscriptParser from '$lib/transcriptParser';
	import { user, content } from '$lib/stores.svelte';
	import Button from '$lib/components/Button.svelte';
	import Semester from '$lib/components/Semester.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import { getCourseData } from '$lib/courseData';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import { goto } from '$app/navigation';
	import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

	let transcript: Transcript | undefined = $state(undefined);

	async function handleFileUpload(event: unknown) {
		// @ts-expect-error
		const file = event.target.files[0];
		if (!file) return;

		const buffer = await file.arrayBuffer();

		const result = await TranscriptParser.parseTranscript(buffer, pdfWorkerUrl);
		if (result !== undefined) {
			transcript = result;
		}
	}

	function onSave(t: Transcript) {
		const currentSemester = t.semesters.length - 1;

		const semesters = t.semesters;
		while (semesters.length < 9) {
			semesters.push([]);
		}

		user.semesters = semesters;
		user.currentSemester = currentSemester;
		user.wishlist = t.exemptions;

		goto('/plan');
	}

	function onCancel() {
		transcript = undefined;
	}
</script>

<div>
	<h2 class="mb-2 text-base font-medium text-content-primary">
		{content.lang.settings.upload}
	</h2>
	{#if transcript === undefined}
		<div class="mb-6 w-fit">
			<div
				class="h-full cursor-pointer rounded-md border border-transparent bg-accent-primary p-0.5 pl-3 pr-3 leading-tight text-content-primary"
			>
				<label class="block h-full w-full cursor-pointer">
					{content.lang.settings.uploadLabel}
					<input
						type="file"
						accept="application/pdf"
						onchange={handleFileUpload}
						class="hidden"
					/>
				</label>
			</div>
		</div>
	{:else}
		<div class="mb-6 flex w-fit flex-row gap-x-1">
			<div class="w-fit">
				<Button variant="primary" onclick={() => onSave(transcript!)}>
					{content.lang.settings.save}
				</Button>
			</div>
			<div class="w-fit">
				<Button variant="secondary" onclick={onCancel}>
					{content.lang.settings.cancel}
				</Button>
			</div>
		</div>
		<div class="mb-4">
			<h2 class="mb-2 text-base font-medium text-content-primary">
				{content.lang.settings.exemptions}
			</h2>
			<CourseRow courses={transcript.exemptions} indent={0}>
				{#snippet children({ course })}
					<CourseElement {course} />
				{/snippet}
			</CourseRow>
		</div>
		<div style="transform: rotateX(180deg)" class="overflow-x-auto">
			<div style="transform: rotateX(180deg)" class="flex flex-row">
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
