<script lang="ts">
	import { content } from '$lib/preferences.svelte';
	import { pwaMessages } from '$lib/pwa/messages';
	let {
		readOnly = false,
		offline = false,
		authPending = false,
		cloudPlanBlocked = false,
		onRetry,
		onSignOut
	}: {
		readOnly?: boolean;
		offline?: boolean;
		authPending?: boolean;
		cloudPlanBlocked?: boolean;
		onRetry: () => void;
		onSignOut: () => void;
	} = $props();
</script>

{#if readOnly}
	<p
		role="status"
		class="ui-notice text-content-primary"
		data-testid="plan-read-only"
	>
		{content.lang.lang === 'he'
			? 'מצב קריאה בלבד ללא אינטרנט. אפשר לעיין בקורסים ובתוכנית השמורה; התחברו כדי לערוך או לשמור.'
			: 'Offline, read-only mode. Browse courses and your saved plan; reconnect to edit or save.'}
	</p>
{/if}
{#if authPending}
	<p role="status" class="ui-notice text-content-primary">
		{content.lang.common.loading}…
	</p>
{:else if cloudPlanBlocked}
	<p
		role="status"
		class="ui-notice text-content-primary"
		data-testid="pwa-account-unavailable"
	>
		{pwaMessages[content.lang.lang].accountUnavailable}
		<button
			type="button"
			class="ui-button ui-button--secondary ms-2 mt-2"
			disabled={offline}
			onclick={onRetry}>{pwaMessages[content.lang.lang].retry}</button
		>
		<button
			type="button"
			class="ui-button ui-button--secondary ms-2 mt-2"
			onclick={onSignOut}>{content.lang.settings.signOut}</button
		>
	</p>
{/if}
