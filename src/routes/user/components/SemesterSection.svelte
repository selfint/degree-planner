<script lang="ts">
	import { semesters, currentSemester } from '$lib/stores';

	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';

	export let semesterChoice: number;
	export let totalSemestersChoice: number;
	export let validTotalValues: number[];
</script>

<div>
	<h2 class="text-lg text-content-primary">Semester</h2>
	<div class="space-y-1">
		<div>
			<span class="text-content-secondary"> Current: </span>
			<Select bind:value={semesterChoice}>
				{#each Array.from({ length: $semesters.length }) as _, i}
					<option value={i}>
						{['Winter', 'Spring', 'Summer'][i % 3]}
						{Math.floor(i / 3) + 1}
					</option>
				{/each}
			</Select>

			{#if semesterChoice !== $currentSemester}
				<Button
					variant="primary"
					onClick={() => {
						if (semesterChoice !== $currentSemester) {
							$currentSemester = semesterChoice;
						}
					}}
				>
					Save
				</Button>
				<Button
					variant="secondary"
					onClick={() => (semesterChoice = $currentSemester)}
				>
					Cancel
				</Button>
			{/if}
		</div>
		<div>
			<span class="text-content-secondary"> Total: </span>
			<Select bind:value={totalSemestersChoice}>
				{#each validTotalValues as i}
					<option value={i}>
						{i}
						({['Winter', 'Spring', 'Summer'][(i - 1) % 3]}
						{Math.floor((i - 1) / 3) + 1})
					</option>
				{/each}
			</Select>

			{#if totalSemestersChoice !== $semesters.length}
				<div class="inline-block h-full">
					<Button
						variant="primary"
						onClick={() => {
							if (totalSemestersChoice < $semesters.length) {
								$semesters = $semesters.slice(0, totalSemestersChoice);
							} else if (totalSemestersChoice > $semesters.length) {
								$semesters = $semesters.concat(
									Array.from({
										length: totalSemestersChoice - $semesters.length
									}).map(() => [])
								);
							}
						}}
					>
						Save
					</Button>
				</div>
				<Button
					variant="secondary"
					onClick={() => (totalSemestersChoice = $semesters.length)}
				>
					Cancel
				</Button>
			{/if}
		</div>
	</div>
</div>
