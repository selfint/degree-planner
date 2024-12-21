<script lang="ts">
	import { user, catalog, content, writeStorage } from '$lib/stores.svelte';

	import Button from '$lib/components/Button.svelte';
	import DegreeSection from './components/DegreeSection.svelte';
	import SemesterSection from './components/SemesterSection.svelte';
	import UploadSection from './components/UploadSection.svelte';

	import { signIn } from '$lib/firebase.svelte';

	const { data: firebase } = $props();

	async function onSignInWithGoogle() {
		await signIn(firebase);
	}

	if (user.username === undefined) {
		user.username = 'guest';
	}

	const recommended = $derived(catalog()?.recommended);

	let userDegree = $state(user.degree);
	let userPath = $state(user.path);

	$effect(() => {
		userDegree = user.degree;
		userPath = user.path;
	});

	async function onChange(
		newDegree: Degree,
		newPath?: string
	): Promise<boolean> {
		user.degree = newDegree;
		user.path = newPath;

		await writeStorage(user);

		userDegree = user.degree;
		userPath = user.path;

		return true;
	}

	function onReset() {
		if (recommended !== undefined) {
			if (!confirm(content.lang.preview.overwriteWarning)) {
				return;
			}

			user.semesters = recommended ?? [];
			user.wishlist = user.wishlist.filter(
				(c) => !recommended.flat().includes(c)
			);
		}
	}

	const maxTotalSemesters = 15;

	const semesterChoice = $derived(user.currentSemester);
	const totalSemestersChoice = $derived(user.semesters.length);

	const maxNonEmptySemesterIndex = $derived(
		user.semesters
			.map((s, i) => [s.length, i])
			.filter(([s]) => s > 0)
			.map(([, i]) => i)
			// get the last non-empty semester
			.reduce((a, b) => Math.max(a, b), 0) + 1
	);

	const validTotalValues = $derived(
		Array.from({ length: maxTotalSemesters }, (_, i) => i + 1).filter(
			(i) => i >= maxNonEmptySemesterIndex
		)
	);

	let currentUser = $state(firebase.auth.currentUser);
	firebase.auth.onAuthStateChanged((u) => (currentUser = u));
</script>

<div class="mt-3">
	<div class="mb-4 ms-3">
		<h1 class="mb-2 text-xl text-content-primary">
			Welcome, {currentUser?.displayName ?? user.username}
		</h1>
		{#if currentUser === null}
			<Button variant="secondary" onclick={onSignInWithGoogle}>
				<span class="flex flex-row gap-x-2">
					<span> Sign in with </span>
					<img
						src="https://www.svgrepo.com/show/355037/google.svg"
						alt="Google Logo"
						class="h-5 w-5"
					/>
				</span>
			</Button>
		{:else}
			<Button
				variant="secondary"
				onclick={async () => await firebase.auth.signOut()}
			>
				<span class="flex h-fit w-fit flex-row gap-x-2 text-center">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						height="24"
						width="24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path
							d="M15 3h5a2 2 0 012 2v14a2 2 0 01-2 2h-5M10 17l5-5-5-5M15 12H3"
						/>
					</svg>
					<span class="text-nowrap"> Sign out </span>
				</span>
			</Button>
		{/if}
	</div>
	<div class="mb-4 ms-3">
		<DegreeSection {userDegree} {userPath} {onChange} {onReset} {recommended} />
	</div>

	{#if userDegree !== undefined}
		<div class="mb-4 ms-3">
			<SemesterSection
				{semesterChoice}
				{totalSemestersChoice}
				{validTotalValues}
			/>
		</div>
	{/if}
	{#if userDegree !== undefined && user.semesters.flat().length === 0}
		<div class="mb-4 ms-3">
			<UploadSection />
		</div>
	{/if}
</div>
