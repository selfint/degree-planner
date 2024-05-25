<script lang="ts">
	import type { Writable } from 'svelte/store';

	export let year: number;
	export let winter: Writable<Course[]>;
	export let spring: Writable<Course[]>;
	export let summer: Writable<Course[]>;
</script>
