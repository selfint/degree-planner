<script lang="ts">
	import LoadingCourseElement from '$lib/components/LoadingCourseElement.svelte';
	import { content } from '$lib/preferences.svelte';

	let {
		squeeze = false,
		withNote = false
	}: { squeeze?: boolean; withNote?: boolean } = $props();
</script>

{#snippet loadingNote()}
	{content.lang.lang === 'he' ? 'טוען פרטי קורס…' : 'Loading course…'}
{/snippet}

<LoadingCourseElement {squeeze} note={withNote ? loadingNote : undefined} />
