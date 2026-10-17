<script lang="ts">
	import { content } from '$lib/stores.svelte';
	import { pwaMessages } from '$lib/pwa/messages';
</script>

<div class="ui-page text-content-primary">
	<p>{pwaMessages[content.lang.lang].offline}</p>
	<a class="ui-button ui-button--secondary mt-4" href="/app/plan"
		>{content.lang.header.plan}</a
	>
</div>
