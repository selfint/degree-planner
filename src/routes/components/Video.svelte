<script lang="ts">
	type Props = {
		src: string;
	};

	let { src }: Props = $props();

	let video: HTMLVideoElement | undefined = $state(undefined);

	$effect(() => {
		if (video !== undefined) {
			video.play().then(() => video!.pause());
		}
	});
</script>

<div
	class="w-full rounded-[15px] border border-white border-opacity-30 bg-white bg-opacity-10 p-2 bg-blend-color-burn backdrop-blur"
>
	<video
		bind:this={video}
		onmouseenter={video?.play}
		onmouseleave={video?.pause}
		class="pointer-events-auto w-full rounded-[10px] bg-transparent"
		playsinline
		muted
		loop
		controls
		preload="auto"
	>
		<source {src} type="video/mp4" />
		Your browser does not support the video tag.
	</video>
</div>
