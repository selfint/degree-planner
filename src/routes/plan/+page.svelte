<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<div class="flex flex-row items-center space-x-2 border-b-2 border-black bg-yellow-200 p-1">
	<h1 class="text-4xl font-bold">Degree plan</h1>
	<div class="flex-grow"></div>
	<button
		on:mousedown={() => goto('/')}
		class="h-12 border-2 border-black bg-teal-200 p-2.5 hover:shadow">Settings</button
	>
</div>
