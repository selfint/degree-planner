<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';

	import { content } from '$lib/stores.svelte';
</script>

<div class="m-3 flex flex-col justify-center lg:mt-32 lg:flex-row">
	<h1
		class="mb-6 w-fit text-5xl text-content-primary md:text-6xl lg:me-20 lg:text-7xl"
	>
		<span class="w-fit">{content.lang.landing.catchphrase[0]}</span>
		<br class="hidden lg:block" />
		<span
			class="w-fit bg-gradient-to-b from-white from-30% to-accent-primary bg-clip-text text-transparent"
		>
			{content.lang.landing.catchphrase[1]}
		</span>
	</h1>

	<div class="lg:w-[520px]">
		<p class="mb-6 text-lg font-medium text-content-secondary">
			{content.lang.landing.about}
		</p>

		<div class="h-9">
			<Button variant="primary" onmousedown={() => goto('/progress')}>
				{content.lang.common.getStarted}
			</Button>
		</div>
	</div>
</div>

<div class="circle relative -z-10 h-[2000px] w-[200%]"></div>

<style>
	.circle {
		background: radial-gradient(#4ca9a1 1%, rgba(0, 0, 0, 0) 70%);
		position: absolute;
		left: -100%;
	}

	/* Adjust for RTL layout */
	:global([dir='rtl'] .circle) {
		left: auto;
		right: -100%;
	}
</style>
