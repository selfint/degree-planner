<script lang="ts">
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';

	import { user, content } from '$lib/stores.svelte';

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
	}
</script>

<div>
	<h2 class="text-lg font-medium text-content-primary">
		{content.lang.common.semester}
	</h2>
	<div class="grid w-fit grid-cols-[auto_auto] gap-x-2 gap-y-1">
		<span class="text-content-secondary">
			{content.lang.progress.current}
		</span>
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
				<Button variant="primary" onmousedown={onUpdateCurrentSemester}>
					{content.lang.progress.save}
				</Button>
			</div>
			<div class="w-fit">
				<Button
					variant="secondary"
					onmousedown={() => (semesterChoice = user.currentSemester)}
				>
					{content.lang.progress.cancel}
				</Button>
			</div>
		{/if}
		<span class="text-content-secondary">
			{content.lang.progress.total}
		</span>
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
				<Button variant="primary" onmousedown={onUpdateTotalSemesters}>
					{content.lang.progress.save}
				</Button>
			</div>
			<div class="w-fit">
				<Button
					variant="secondary"
					onmousedown={() => (totalSemestersChoice = user.semesters.length)}
				>
					{content.lang.progress.cancel}
				</Button>
			</div>
		{/if}
	</div>
</div>
