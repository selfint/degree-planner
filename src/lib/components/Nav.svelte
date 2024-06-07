<script lang="ts">
	import { page } from '$app/stores';

	export let target: string;
	$: border =
		'/' + target === $page.url.pathname
			? 'border-b-2 border-accent-primary'
			: '';
</script>

<a href="/{target}" class="{border} text-2xl font-thin text-content-primary">
	<slot />
</a>
