<script lang="ts">
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';

	import { user } from '$lib/stores.svelte';
	import { getLang } from '$lib/content';

	const lang = getLang();

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
		{lang.progress.semester}
	</h2>
	<div class="space-y-1">
		<div>
			<span class="text-content-secondary"> {lang.progress.current}: </span>
			<Select bind:value={semesterChoice}>
				{#each Array.from({ length: user.semesters.length }) as _, i}
					<option value={i}>
						{lang.common.seasons[i % 3]}
						{Math.floor(i / 3) + 1}
					</option>
				{/each}
			</Select>

			{#if semesterChoice !== user.currentSemester}
				<Button variant="primary" onmousedown={onUpdateCurrentSemester}>
					Save
				</Button>
				<Button
					variant="secondary"
					onmousedown={() => (semesterChoice = user.currentSemester)}
				>
					{lang.progress.cancel}
				</Button>
			{/if}
		</div>
		<div>
			<span class="text-content-secondary"> {lang.progress.total}: </span>
			<Select bind:value={totalSemestersChoice}>
				{#each validTotalValues as i}
					<option value={i}>
						{i}
						({lang.common.seasons[(i - 1) % 3]}
						{Math.floor((i - 1) / 3) + 1})
					</option>
				{/each}
			</Select>

			{#if totalSemestersChoice !== user.semesters.length}
				<Button variant="primary" onmousedown={onUpdateTotalSemesters}>
					{lang.progress.save}
				</Button>
				<Button
					variant="secondary"
					onmousedown={() => (totalSemestersChoice = user.semesters.length)}
				>
					{lang.progress.cancel}
				</Button>
			{/if}
		</div>
	</div>
</div>
