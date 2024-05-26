<script lang="ts">
	import { goto } from '$app/navigation';

	import { courses, groups } from '$lib/stores';
</script>

<div class="flex flex-row items-center space-x-2 border-b-2 border-black bg-yellow-200 p-1">
	<h1 class="text-4xl font-bold">Degree plan</h1>
	<div class="flex-grow"></div>
	<button
		on:mousedown={() => goto('/')}
		class="h-12 border-2 border-black bg-teal-200 p-2.5 font-bold hover:shadow">Settings</button
	>
</div>

<div class="flex flex-row">
	<div class="p-2.5">
		<h2 class="text-2xl font-bold">Catalog</h2>
		{#each $courses as course}
			{#if course.info !== undefined}
				<p>{course.info?.name}</p>
			{/if}
		{/each}
	</div>
	<div class="p-2.5">
		<h2 class="text-2xl font-bold">Wishlist</h2>
		{#each $courses as course}
			{#if course.info !== undefined}
				<p>{course.info?.name}</p>
			{/if}
		{/each}
	</div>
</div>
