<script lang="ts">
	import { user, catalog, content } from '$lib/stores.svelte';
	import { loadCatalog } from '$lib/requirements';

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

	// we can't trust svelte to notify us when the degree value *actually*
	// changes, so we need to keep track of it ourselves
	// this is *the only* place where we should be setting the degree value
	function onChange(newDegree: Degree, newPath?: string): boolean {
		loadCatalog(newDegree, newPath).then((data) => {
			user.degree = newDegree;
			user.path = newPath;

			if (user.semesters.length === 0) {
				user.semesters = data.recommended ?? [];
				while (user.semesters.length < user.currentSemester) {
					user.semesters.push([]);
				}
				if (user.semesters.length === 0) {
					user.semesters.push([]);
				}
				user.wishlist = user.wishlist.filter(
					(c) => !data.recommended.flat().includes(c)
				);
			}
		});

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
		<h1 class="text-xl text-content-primary">
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
		{/if}
	</div>
	<div class="mb-4 ms-3">
		<DegreeSection
			userDegree={user.degree}
			userPath={user.path}
			{onChange}
			{onReset}
			{recommended}
		/>
	</div>

	{#if user.degree !== undefined}
		<div class="mb-4 ms-3">
			<SemesterSection
				{semesterChoice}
				{totalSemestersChoice}
				{validTotalValues}
			/>
		</div>
	{/if}
	{#if user.degree !== undefined && user.semesters.flat().length === 0}
		<div class="mb-4 ms-3">
			<UploadSection />
		</div>
	{/if}
</div>
