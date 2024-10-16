<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
</script>

<div class="m-3 flex flex-col justify-center lg:mt-32 lg:flex-row lg:space-x-8">
	<h1 class="mb-6 w-fit text-5xl text-content-primary md:text-6xl">
		<span class="w-fit">Plan your courses</span>
		<br class="hidden lg:block" />
		<span
			class="w-fit bg-gradient-to-b from-white from-30% to-accent-primary bg-clip-text text-transparent"
		>
			with confidence.
		</span>
	</h1>

	<div class="lg:w-1/3">
		<p class="mb-6 text-lg font-medium text-content-secondary">
			Setup a plan for your entire degree that fits your interests and maximizes
			your potential. Get personalized suggestions each semester for the optimal
			test schedule. Discover courses, save the ones you like and we will
			scheduled them for you.
		</p>

		<div class="h-9">
			<Button variant="primary" onmousedown={() => goto('/user')}>
				Get started
			</Button>
		</div>
	</div>
</div>

<div class="circle relative left-[-100%] -z-10 h-[2000px] w-[200%]"></div>

<style>
	.circle {
		background: radial-gradient(#4ca9a1 1%, rgba(0, 0, 0, 0) 70%);
	}
</style>
