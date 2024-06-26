<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
</script>

<div class="mt-32 flex flex-col justify-center lg:flex-row">
	<h1 class="mr-8 w-full text-6xl text-content-primary lg:w-1/3 lg:text-6xl">
		<span class="w-fit">Plan your courses</span>
		<br class="hidden lg:block" />
		<span class="gradient w-fit">with confidence.</span>
	</h1>

	<div class="lg:w-1/4">
		<p class="mb-8 text-xl text-content-secondary">
			Setup a plan for your entire degree that fits your interests and maximizes
			your potential. Get personalized suggestions each semester for the optimal
			test schedule. Discover courses, save the ones you like and we will
			scheduled them for you.
		</p>

		<Button variant="primary" onClick={() => goto('/user')}>Get started</Button>
	</div>
</div>

<div class="circle" />

<style>
	.circle {
		width: 350%;
		height: 2000px;
		border-radius: 50%;
		position: absolute;
		top: 400px;
		left: -250%;
		background: radial-gradient(#4ca9a1 1%, rgba(0, 0, 0, 0) 70%);
		z-index: -1;
	}

	.gradient {
		background: linear-gradient(#ffffff 30%, #4ca9a1);
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}
</style>
