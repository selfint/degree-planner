<script lang="ts">
	export let value: unknown;
</script>

<select
	bind:value
	class="w-fit rounded-md border border-border bg-background p-2 text-content-secondary outline-none"
>
	<slot />
</select>
