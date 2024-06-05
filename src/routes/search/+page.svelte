<script lang="ts">
	import { page } from '$app/stores';

	$: query = $page.url.searchParams.get('q') ?? '';
</script>

<div class="text-content-primary">
	{query}
</div>
