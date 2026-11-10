<script lang="ts">
	import { content } from '$lib/preferences.svelte';
</script>

<aside
	class="staging-banner"
	dir={content.lang.dir}
	data-testid="staging-banner"
>
	<strong
		>STAGING · {content.lang.lang === 'he'
			? 'ללא אנליטיקה'
			: 'Analytics off'}</strong
	>
	<span>
		{content.lang.lang === 'he'
			? 'התוכניות בחשבון משותפות לאתר הראשי. שינויים שיישמרו כאן ישנו גם את התוכנית האמיתית שלכם.'
			: 'Account plans are shared with production. Saving here changes your real plan.'}
	</span>
</aside>

<style>
	.staging-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.25rem 0.75rem;
		padding: 0.5rem 1rem;
		background: #fef3c7;
		color: #78350f;
		border-block-end: 1px solid #d97706;
		font-size: 0.8125rem;
		line-height: 1.5;
		text-align: center;
	}
</style>
