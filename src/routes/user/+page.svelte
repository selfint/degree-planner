<script lang="ts">
	import { userData } from '$lib/stores';
</script>

{#if $userData === undefined}
	<a
		href="/login"
		class="border-b-2 border-background text-4xl font-semibold tracking-tight text-content-primary"
	>
		Login
	</a>
{:else}
	<a
		href="/user"
		class="border-b-2 border-background text-4xl font-semibold tracking-tight text-content-primary"
	>
		{$userData.username}
	</a>
{/if}
