<script lang="ts">
	export let value: number;
	export let max: number;

	let p = Math.floor((value / max) * 100);
</script>

<div class="h-4 w-56 rounded-md bg-card-primary">
	<div id="prg" style="width: {p}%" class="h-4 rounded-md bg-accent-primary" />
</div>
