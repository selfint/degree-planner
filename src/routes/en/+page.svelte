<script lang="ts">
	import { goto } from '$app/navigation';

	import { browser } from '$app/environment';

	import { content } from '$lib/preferences.svelte';
	import { cms } from '$lib/content';

	if (browser) {
		try {
			localStorage.setItem('lang', 'en');
		} catch {
			// Continue with the in-memory preference when storage is unavailable.
		}
		content.lang = cms.en;

		goto('/');
	}
</script>
