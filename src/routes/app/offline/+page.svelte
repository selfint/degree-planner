<script lang="ts">
	import { content } from '$lib/stores.svelte';
	import { pwaMessages } from '$lib/pwa/messages';
</script>

<div class="m-5 text-content-primary">
	<p>{pwaMessages[content.lang.lang].offline}</p>
	<a class="underline" href="/app/plan">{content.lang.header.plan}</a>
</div>
