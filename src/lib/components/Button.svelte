<script lang="ts">
	export let onClick: () => void;
	export let variant: 'primary' | 'secondary';

	const bg = variant === 'primary' ? 'bg-accent-primary' : 'bg-card-secondary';
</script>

<button
	class="h-full rounded-md border border-transparent p-0.5 pl-3 pr-3 {bg} text-content-primary"
	on:click={onClick}
>
	<slot />
</button>
