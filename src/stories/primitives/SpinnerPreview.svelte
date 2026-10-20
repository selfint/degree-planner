<script lang="ts">
	import Spinner from '$lib/components/Spinner.svelte';
	let { size = 'compact' }: { size?: 'compact' | 'large' } = $props();
</script>

<div class={size === 'large' ? 'h-12 w-12' : 'h-7 w-7'}>
	<Spinner />
</div>
