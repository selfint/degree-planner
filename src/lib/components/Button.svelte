<script lang="ts">
	export let onClick: () => void;
	export let variant: 'primary' | 'secondary';
	const bg = variant === 'primary' ? 'bg-accent-primary' : 'bg-card-secondary';
</script>

<button
	class="rounded-md p-2 pl-3 pr-3 {bg} text-content-primary"
	on:click={onClick}
>
	<slot />
</button>
