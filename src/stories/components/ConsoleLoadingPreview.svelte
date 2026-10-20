<script lang="ts">
	import ConsoleLoading from '$lib/components/ConsoleLoading.svelte';
	import { content } from '$lib/preferences.svelte';
	let { phase = 'courses' }: { phase?: 'courses' | 'opening' } = $props();
</script>

<ConsoleLoading
	language={content.lang.lang}
	direction={content.lang.dir}
	{phase}
/>
