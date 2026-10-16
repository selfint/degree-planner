<script lang="ts">
	import { page } from '$app/state';
	import { content } from '$lib/preferences.svelte';
</script>

<div class="m-5">
	<h1 class="text-2xl text-content-primary">
		{page.status} - {page.status === 404
			? content.lang.error.notFound
			: content.lang.error.loadFailed}
	</h1>
	{#if page.status !== 404}
		<p class="mt-2 text-content-secondary">{content.lang.error.retry}</p>
	{/if}
</div>
