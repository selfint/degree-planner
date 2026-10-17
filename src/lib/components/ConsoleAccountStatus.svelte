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
		class="mx-3 my-2 rounded-md bg-card-primary p-3 text-content-primary"
		data-testid="plan-read-only"
	>
		{content.lang.lang === 'he'
			? 'מצב קריאה בלבד ללא אינטרנט. אפשר לעיין בקורסים ובתוכנית השמורה; התחברו כדי לערוך או לשמור.'
			: 'Offline, read-only mode. Browse courses and your saved plan; reconnect to edit or save.'}
	</p>
{/if}
{#if authPending}
	<p role="status" class="m-5 flex-grow text-content-primary">
		{content.lang.common.loading}…
	</p>
{:else if cloudPlanBlocked}
	<p
		role="status"
		class="m-5 flex-grow text-content-primary"
		data-testid="pwa-account-unavailable"
	>
		{pwaMessages[content.lang.lang].accountUnavailable}
		<button
			type="button"
			class="ms-2 underline disabled:opacity-50"
			disabled={offline}
			onclick={onRetry}>{pwaMessages[content.lang.lang].retry}</button
		>
		<button type="button" class="ms-2 underline" onclick={onSignOut}
			>{content.lang.settings.signOut}</button
		>
	</p>
{/if}
