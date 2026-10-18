<script lang="ts">
	import { planOnline } from '$lib/planAccess';
	import Select from '$lib/components/Select.svelte';

	import { user, content, writeStorage, setUser } from '$lib/stores.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import PlanActionButton from '$lib/components/PlanActionButton.svelte';

	type Props = {
		semesterChoice: number;
		totalSemestersChoice: number;
		validTotalValues: number[];
		buttonNamespace: string;
	};

	let {
		semesterChoice,
		totalSemestersChoice,
		validTotalValues,
		buttonNamespace = $bindable()
	}: Props = $props();

	async function onUpdateCurrentSemester() {
		if (semesterChoice !== user.d.currentSemester) {
			setUser(
				await writeStorage({
					...user.d,
					currentSemester: semesterChoice
				})
			);
		}
	}

	async function onUpdateTotalSemesters() {
		const semesters =
			totalSemestersChoice < user.d.semesters.length
				? user.d.semesters.slice(0, totalSemestersChoice)
				: user.d.semesters.concat(
						Array.from({
							length: totalSemestersChoice - user.d.semesters.length
						}).map(() => [])
					);

		setUser(await writeStorage({ ...user.d, semesters }));
	}
</script>

<section class="semester-section">
	<h2 class="section-title">{content.lang.common.semester}</h2>
	<div class="semester-fields">
		<div class="semester-field">
			<label class="settings-field">
				<span>{content.lang.settings.current}</span>
				<Select disabled={!$planOnline} bind:value={semesterChoice}>
					{#each Array.from({ length: user.d.semesters.length }) as _, i}
						<option value={i}>
							{content.lang.common.seasons[i % 3]}
							{Math.floor(i / 3) + 1}
						</option>
					{/each}
				</Select>
			</label>
			{#if semesterChoice !== user.d.currentSemester}
				<div class="field-actions">
					<PlanActionButton
						variant="primary"
						onclick={onUpdateCurrentSemester}
						bind:buttonNamespace
						name="save-semesters"
					>
						{content.lang.settings.save}
					</PlanActionButton>
					<AsyncButton
						variant="secondary"
						onclick={async () => {
							semesterChoice = user.d.currentSemester;
						}}
						bind:buttonNamespace
						name="cancel-semesters"
					>
						{content.lang.settings.cancel}
					</AsyncButton>
				</div>
			{/if}
		</div>
		<div class="semester-field">
			<label class="settings-field">
				<span>{content.lang.settings.total}</span>
				<Select disabled={!$planOnline} bind:value={totalSemestersChoice}>
					{#each validTotalValues as i}
						<option value={i}>
							{i}
							({content.lang.common.seasons[(i - 1) % 3]}
							{Math.floor((i - 1) / 3) + 1})
						</option>
					{/each}
				</Select>
			</label>
			{#if totalSemestersChoice !== user.d.semesters.length}
				<div class="field-actions">
					<PlanActionButton
						variant="primary"
						onclick={onUpdateTotalSemesters}
						bind:buttonNamespace
						name="save-total"
					>
						{content.lang.settings.save}
					</PlanActionButton>
					<AsyncButton
						variant="secondary"
						onclick={async () => {
							totalSemestersChoice = user.d.semesters.length;
						}}
						bind:buttonNamespace
						name="cancel-total"
					>
						{content.lang.settings.cancel}
					</AsyncButton>
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.semester-section {
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
	.semester-fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.semester-field,
	.settings-field {
		min-inline-size: 0;
	}
	.settings-field {
		display: grid;
		gap: 0.25rem;
	}
	.settings-field > span {
		font-weight: 500;
	}
	.field-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-block-start: 0.5rem;
	}
</style>
