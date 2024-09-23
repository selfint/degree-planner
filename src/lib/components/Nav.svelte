<script lang="ts">
	import { page } from '$app/stores';

	export let target: string;
	$: border =
		'/' + target === $page.url.pathname
			? 'border-b-2 border-accent-primary'
			: 'border-b-2 border-transparent';
</script>

<a
	href="/{target}"
	class="{border} w-fit text-2xl font-thin text-content-primary"
>
	<slot />
</a>
