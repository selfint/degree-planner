<script lang="ts">
	import { resolve } from '$app/paths';
	import { content } from '$lib/stores.svelte';
</script>

<div class="ui-notice m-3" role="status" data-testid="curriculum-unavailable">
	<p>
		{content.lang.lang === 'he'
			? 'תוכנית הלימודים אינה זמינה כעת. הקורסים ששמרת לא השתנו.'
			: 'This curriculum is currently unavailable. Your saved courses are unchanged.'}
	</p>
	<a class="underline" href={resolve('/app/settings')}>
		{content.lang.lang === 'he'
			? 'בחירת מסלול זמין בהגדרות'
			: 'Choose an available degree in Settings'}
	</a>
</div>
