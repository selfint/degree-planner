<script lang="ts">
	import Search from '$lib/components/Search.svelte';
	import { content } from '$lib/preferences.svelte';

	let submitted = $state<string | undefined>();
</script>

<div class="flex flex-col items-start gap-3">
	<Search onsubmit={(query) => (submitted = query)} />
	<p class="text-sm text-content-secondary" aria-live="polite">
		{#if submitted === undefined}
			{content.lang.lang === 'he'
				? 'הקלידו חיפוש ולחצו Enter.'
				: 'Type a query and press Enter.'}
		{:else}
			{content.lang.lang === 'he' ? 'חיפוש שנשלח' : 'Submitted query'}:
			{submitted || (content.lang.lang === 'he' ? '(ריק)' : '(empty)')}
		{/if}
	</p>
</div>
