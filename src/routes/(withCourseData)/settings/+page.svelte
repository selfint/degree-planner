<script lang="ts">
	import { user, content, writeStorage, setUser } from '$lib/stores.svelte';

	import Button from '$lib/components/Button.svelte';
	import DegreeSection from './components/DegreeSection.svelte';
	import SemesterSection from './components/SemesterSection.svelte';
	import UploadSection from './components/UploadSection.svelte';

	import { signIn } from '$lib/firebase.svelte';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import { goto } from '$app/navigation';

	const { data: pageData } = $props();
	const { getCourseData, firebase, catalogs } = pageData;

	async function onSignInWithGoogle() {
		await signIn(firebase);
	}

	const userDegree = $derived(user.d.degree);
	const userPath = $derived(user.d.path);

	async function onChange(
		newDegree: Degree,
		newPath?: string
	): Promise<boolean> {
		setUser(
			await writeStorage({
				...user.d,
				degree: newDegree,
				path: newPath
			})
		);

		return true;
	}

	const maxTotalSemesters = 15;
	const semesterChoice = $derived(user.d.currentSemester);
	const totalSemestersChoice = $derived(user.d.semesters.length);

	const maxNonEmptySemesterIndex = $derived(
		user.d.semesters
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

	let buttonNamespace = $state('');
</script>

<div class="mt-3">
	<div class="mb-4 ms-3 flex flex-row gap-x-2">
		<h1 class="mb-2 text-xl text-content-primary">
			{currentUser?.displayName ?? content.lang.settings.guest}
		</h1>
		{#if currentUser === null}
			<Button variant="secondary" onclick={onSignInWithGoogle}>
				<span
					class="flex h-fit w-fit flex-row items-center gap-x-2 pb-0.5 pt-0.5"
				>
					<span class="text-nowrap">{content.lang.settings.signInWith}</span>
					<img
						src="https://www.svgrepo.com/show/355037/google.svg"
						loading="lazy"
						alt="Google Logo"
						class="h-5 w-5"
					/>
				</span>
			</Button>
		{:else}
			<AsyncButton
				variant="secondary"
				onclick={async () => await firebase.auth.signOut()}
				bind:buttonNamespace
				name="signout"
			>
				<span
					class="flex h-fit w-fit flex-row items-center gap-x-2 pb-0.5 pt-0.5"
				>
					<span class="text-nowrap">{content.lang.settings.signOut}</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						height="20"
						width="20"
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
				</span>
			</AsyncButton>
		{/if}
	</div>
	<div class="mb-4 ms-3">
		<DegreeSection
			{catalogs}
			{userDegree}
			{userPath}
			{onChange}
			onReset={() => {}}
			recommended={undefined}
			bind:buttonNamespace
		/>
	</div>

	{#if userDegree !== undefined}
		<div class="mb-4 ms-3">
			<SemesterSection
				{semesterChoice}
				{totalSemestersChoice}
				{validTotalValues}
				bind:buttonNamespace
			/>
		</div>
	{/if}
	{#if userDegree !== undefined && user.d.semesters.flat().length === 0}
		<div class="mb-4">
			<UploadSection {getCourseData} bind:buttonNamespace />
		</div>
	{/if}
	{#if user.d.exemptions.length > 0}
		<div class="mb-4">
			<h2 class="mb-2 ms-3 text-base font-medium text-content-primary">
				{content.lang.settings.exemptions}
			</h2>
			<CourseRow {getCourseData} courses={user.d.exemptions}>
				{#snippet children({ code, course, index })}
					<div
						role="button"
						tabindex={index}
						onclick={() => goto(`/course/${code}`)}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								goto(`/course/${code}`);
							}
						}}
					>
						<CourseElement {code} {course} />
					</div>
				{/snippet}
			</CourseRow>
		</div>
	{/if}
</div>
