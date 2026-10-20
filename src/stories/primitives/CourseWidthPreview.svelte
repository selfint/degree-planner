<script lang="ts">
	import CourseWidth from '$lib/components/CourseWidth.svelte';
	import { content } from '$lib/preferences.svelte';

	let { longContent = false }: { longContent?: boolean } = $props();
	const he = $derived(content.lang.lang === 'he');
</script>

<CourseWidth class="rounded-md bg-card-primary p-2">
	<p class="text-xs text-content-secondary">
		104031 · {he ? '5 נקודות' : '5 credits'}
	</p>
	<p class="break-words text-content-primary">
		{longContent
			? he
				? 'מבוא מורחב למתמטיקה דיסקרטית ולשיטות קומבינטוריות'
				: 'Introduction to Discrete Mathematics and Combinatorial Methods'
			: he
				? 'חשבון אינפיניטסימלי 1'
				: 'Calculus 1'}
	</p>
</CourseWidth>
