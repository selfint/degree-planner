<script lang="ts">
	export let onClick: () => void;
	export let variant: 'primary' | 'secondary';
</script>

<button
	class="rounded-md p-2 bg-{variant === 'primary'
		? 'accent-primary'
		: 'accent-secondary'} text-content-primary"
	on:click={onClick}
>
	<slot />
</button>
