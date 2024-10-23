<script lang="ts">
	type Props = {
		src: string;
	};

	let { src }: Props = $props();

	let video: HTMLVideoElement;

	$effect(() => {
		video.play();
		video.pause();
	});
</script>

<div
	class="w-full rounded-lg border border-white border-opacity-30 bg-white bg-opacity-10 p-2 bg-blend-color-burn shadow-md backdrop-blur"
>
	<video
		bind:this={video}
		onmouseenter={video.play}
		onmouseleave={video.pause}
		class="pointer-events-auto w-full rounded-none bg-transparent"
		playsinline
		muted
		loop
		controls
	>
		<source {src} type="video/mp4" />
		Your browser does not support the video tag.
	</video>
</div>
