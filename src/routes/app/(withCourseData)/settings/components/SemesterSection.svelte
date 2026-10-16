<script lang="ts">
	import Select from '$lib/components/Select.svelte';

	import { user, content, writeStorage, setUser } from '$lib/stores.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';

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

<div>
	<h2 class="text-base font-medium text-content-primary">
		{content.lang.common.semester}
	</h2>
	<div class="grid w-fit grid-cols-[auto_auto] items-baseline gap-x-2 gap-y-1">
		<span class="text-content-secondary">
			{content.lang.settings.current}
		</span>
		<div class="flex flex-row gap-x-1">
			<Select bind:value={semesterChoice}>
				{#each Array.from({ length: user.d.semesters.length }) as _, i}
					<option value={i}>
						{content.lang.common.seasons[i % 3]}
						{Math.floor(i / 3) + 1}
					</option>
				{/each}
			</Select>

			{#if semesterChoice !== user.d.currentSemester}
				<div class="w-fit">
					<AsyncButton
						variant="primary"
						onclick={onUpdateCurrentSemester}
						bind:buttonNamespace
						name="save-semesters"
					>
						{content.lang.settings.save}
					</AsyncButton>
				</div>
				<div class="w-fit">
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
		<span class="text-content-secondary">
			{content.lang.settings.total}
		</span>
		<div class="flex flex-row gap-x-1">
			<Select bind:value={totalSemestersChoice}>
				{#each validTotalValues as i}
					<option value={i}>
						{i}
						({content.lang.common.seasons[(i - 1) % 3]}
						{Math.floor((i - 1) / 3) + 1})
					</option>
				{/each}
			</Select>
			{#if totalSemestersChoice !== user.d.semesters.length}
				<div class="w-fit">
					<AsyncButton
						variant="primary"
						onclick={onUpdateTotalSemesters}
						bind:buttonNamespace
						name="save-total"
					>
						{content.lang.settings.save}
					</AsyncButton>
				</div>
				<div class="w-fit">
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
</div>
