<script lang="ts">
	import ConsoleLoading from '$lib/components/ConsoleLoading.svelte';
	import { content } from '$lib/preferences.svelte';
	import type { ConsoleLoadingState } from '$lib/consoleLoading';
	let { state = { phase: 'opening' } }: { state?: ConsoleLoadingState } =
		$props();
</script>

<ConsoleLoading
	language={content.lang.lang}
	direction={content.lang.dir}
	{state}
/>
