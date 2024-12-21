<script lang="ts">
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';

	import { user, content, writeStorage } from '$lib/stores.svelte';

	type Props = {
		semesterChoice: number;
		totalSemestersChoice: number;
		validTotalValues: number[];
	};

	let { semesterChoice, totalSemestersChoice, validTotalValues }: Props =
		$props();

	function onUpdateCurrentSemester() {
		if (semesterChoice !== user.currentSemester) {
			user.currentSemester = semesterChoice;
			writeStorage(user);
		}
	}

	function onUpdateTotalSemesters() {
		if (totalSemestersChoice < user.semesters.length) {
			user.semesters = user.semesters.slice(0, totalSemestersChoice);
		} else if (totalSemestersChoice > user.semesters.length) {
			user.semesters = user.semesters.concat(
				Array.from({
					length: totalSemestersChoice - user.semesters.length
				}).map(() => [])
			);
		}
		writeStorage(user);
	}
</script>

<div>
	<h2 class="text-base font-medium text-content-primary">
		{content.lang.common.semester}
	</h2>
	<div class="grid w-fit grid-cols-[auto_auto] gap-x-2 gap-y-1">
		<span class="text-content-secondary">
			{content.lang.settings.current}
		</span>
		<div class="flex flex-row gap-x-1">
			<Select bind:value={semesterChoice}>
				{#each Array.from({ length: user.semesters.length }) as _, i}
					<option value={i}>
						{content.lang.common.seasons[i % 3]}
						{Math.floor(i / 3) + 1}
					</option>
				{/each}
			</Select>

			{#if semesterChoice !== user.currentSemester}
				<div class="w-fit">
					<Button variant="primary" onclick={onUpdateCurrentSemester}>
						{content.lang.settings.save}
					</Button>
				</div>
				<div class="w-fit">
					<Button
						variant="secondary"
						onclick={() => (semesterChoice = user.currentSemester)}
					>
						{content.lang.settings.cancel}
					</Button>
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
			{#if totalSemestersChoice !== user.semesters.length}
				<div class="w-fit">
					<Button variant="primary" onclick={onUpdateTotalSemesters}>
						{content.lang.settings.save}
					</Button>
				</div>
				<div class="w-fit">
					<Button
						variant="secondary"
						onclick={() => (totalSemestersChoice = user.semesters.length)}
					>
						{content.lang.settings.cancel}
					</Button>
				</div>
			{/if}
		</div>
	</div>
</div>
