<script module lang="ts">
	type SemesterPlan = { semesters: string[][]; currentSemester: number };
	const maxTotalSemesters = 15;

	/** A shorter plan must retain both its current and last occupied semester. */
	export function semesterCountChoices(plan: SemesterPlan): number[] {
		const lastOccupied = plan.semesters.reduce(
			(last, semester, index) => (semester.length > 0 ? index : last),
			0
		);
		const minimum = Math.max(plan.currentSemester, lastOccupied) + 1;
		return Array.from(
			{ length: maxTotalSemesters },
			(_, index) => index + 1
		).filter((count) => count >= minimum);
	}

	export function resizePlanSemesters<T extends SemesterPlan>(
		plan: T,
		total: number
	): T {
		if (!semesterCountChoices(plan).includes(total)) {
			throw new RangeError(
				'Choose a total that retains the current and all occupied semesters.'
			);
		}
		const semesters =
			total < plan.semesters.length
				? plan.semesters.slice(0, total)
				: plan.semesters.concat(
						Array.from({ length: total - plan.semesters.length }, () => [])
					);
		return { ...plan, semesters };
	}
</script>

<script lang="ts">
	import { planOnline } from '$lib/planAccess';
	import Select from '$lib/components/Select.svelte';

	import { user, content, writeStorage, setUser } from '$lib/stores.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import PlanActionButton from '$lib/components/PlanActionButton.svelte';

	type Props = {
		semesterChoice: number;
		totalSemestersChoice: number;
		buttonNamespace: string;
	};

	let {
		semesterChoice,
		totalSemestersChoice,
		buttonNamespace = $bindable()
	}: Props = $props();

	const validTotalValues = $derived(semesterCountChoices(user.d));
	let totalError = $state(false);

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
		totalError = false;
		let updated: UserData;
		try {
			// Re-evaluate against saved state, not the options when the draft began.
			updated = resizePlanSemesters(user.d, totalSemestersChoice);
		} catch (error) {
			if (!(error instanceof RangeError)) throw error;
			totalError = true;
			return;
		}
		setUser(await writeStorage(updated));
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
			{#if totalError}
				<p role="alert" class="mt-1 text-sm text-content-secondary">
					{content.lang.lang === 'he'
						? 'מספר הסמסטרים חייב לכלול את הסמסטר הנוכחי וכל סמסטר עם קורסים. בחרו ושמרו סמסטר נוכחי מוקדם יותר לפני קיצור התוכנית.'
						: 'Keep the current semester and every semester with courses. Choose and save an earlier current semester before shortening the plan.'}
				</p>
			{/if}
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
