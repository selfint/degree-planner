<script lang="ts">
	export let onNewYear: (name: string) => boolean;

	let name: string | undefined = undefined;

	function submit(): void {
		if (name === undefined) {
			return;
		}

		if (onNewYear(name)) {
			name = undefined;
		}
	}
</script>

<form on:submit|preventDefault={submit}>
	<div class="flex flex-row items-center">
		<div class="flex w-fit flex-row">
			<label for="group-name" class="text-white">Name:</label>
			<div class="min-w-1 flex-grow" />
			<input
				type="text"
				id="group-name"
				bind:value={name}
				class="rounded-md border-2 border-dark-400 bg-dark-50 pl-1 text-white focus:bg-teal-700 focus:outline-none"
			/>
		</div>
		<div class="flex-grow"></div>
		<button
			class="bg-teal h-12 w-fit border-2 border-dark-400 bg-teal-800 p-2 text-white"
			type="submit"
		>
			Add
		</button>
	</div>
</form>
