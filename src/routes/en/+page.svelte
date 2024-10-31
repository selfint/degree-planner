<script lang="ts">
	import { goto } from '$app/navigation';

	import { browser } from '$app/environment';

	import { content } from '$lib/stores.svelte';
	import { cms } from '$lib/content';

	if (browser) {
		localStorage.setItem('lang', 'en');
		content.lang = cms.en;

		goto('/');
	}
</script>
