<script lang="ts">
	import { content } from '$lib/preferences.svelte';
	import AppFooter from '$lib/components/AppFooter.svelte';
	import LandingInstallInfo from '$lib/components/LandingInstallInfo.svelte';
	let { installationHelp = false } = $props<{ installationHelp?: boolean }>();
</script>

<div dir={content.lang.dir} class="mx-auto max-w-5xl">
	{#if installationHelp}<LandingInstallInfo />{/if}
	<AppFooter persistPreferences={false} />
</div>
