<script lang="ts">
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { content } from '$lib/preferences.svelte';

	let {
		value = 48,
		value2 = 72,
		max = 120,
		color
	}: {
		value?: number;
		value2?: number;
		max?: number;
		color?: string;
	} = $props();
</script>

<div class="flex flex-col gap-2">
	<p class="text-sm text-content-secondary">
		{content.lang.lang === 'he'
			? 'הושלמו / בתכנון / נדרשים'
			: 'Completed / planned / required'}:
		{value} / {value2} / {max}
	</p>
	<ProgressBar {value} {value2} {max} {color} dir={content.lang.dir} />
</div>
