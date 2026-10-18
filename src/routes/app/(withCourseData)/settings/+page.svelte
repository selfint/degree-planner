<script lang="ts">
	import { user, content, writeStorage, setUser } from '$lib/stores.svelte';

	import DegreeSection from './components/DegreeSection.svelte';
	import SemesterSection from './components/SemesterSection.svelte';
	import UploadSection from './components/UploadSection.svelte';

	import { signIn } from '$lib/firebase.svelte';
	import {
		signInErrorKind,
		type SignInErrorKind
	} from '$lib/pwa/sign-in-error';
	import { pwaMessages } from '$lib/pwa/messages';
	import CourseRow from '$lib/components/CourseRow.svelte';
	import CourseElement from '$lib/components/CourseElement.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	const { data: pageData } = $props();
	const { getCourseData, firebase, catalogs } = $derived(pageData);

	let signInError = $state<SignInErrorKind | undefined>();
	let signInHostname = $state('');
	async function onSignInWithGoogle() {
		signInError = undefined;
		signInHostname = location.hostname;
		try {
			await signIn(firebase);
		} catch (error) {
			signInError = signInErrorKind(error);
		}
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

	let currentUser = $derived(firebase.auth.currentUser);
	$effect(() => {
		const unsubscribe = firebase.auth.onAuthStateChanged(
			(u) => (currentUser = u)
		);

		return () => unsubscribe();
	});

	let buttonNamespace = $state('');
</script>

<div class="ui-page settings-page">
	<header class="page-heading">
		<h1 class="ui-page-title">{content.lang.landing.settings.header}</h1>
	</header>

	<section class="account-section">
		<div class="account-identity">
			<h2>{currentUser?.displayName ?? content.lang.settings.guest}</h2>
		</div>
		{#if currentUser === null}
			<AsyncButton variant="secondary" onclick={onSignInWithGoogle}>
				<span class="account-action">
					<span>{content.lang.settings.signInWith}</span>
					<img
						src="https://www.svgrepo.com/show/355037/google.svg"
						loading="lazy"
						alt="Google Logo"
						class="h-5 w-5 shrink-0"
					/>
				</span>
			</AsyncButton>
		{:else}
			<AsyncButton
				variant="secondary"
				onclick={async () => await firebase.auth.signOut()}
				bind:buttonNamespace
				name="signout"
			>
				<span class="account-action">
					<span>{content.lang.settings.signOut}</span>
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
						aria-hidden="true"
					>
						<path
							d="M15 3h5a2 2 0 012 2v14a2 2 0 01-2 2h-5M10 17l5-5-5-5M15 12H3"
						/>
					</svg>
				</span>
			</AsyncButton>
		{/if}
		{#if signInError}
			<p role="alert" class="sign-in-error" data-testid="sign-in-error">
				{pwaMessages[content.lang.lang].signInErrors[signInError]}
				{#if signInError === 'domain'}<span dir="ltr">{signInHostname}</span
					>{/if}
			</p>
		{/if}
	</section>

	{#await catalogs}
		<section class="loading-section">
			<h2 class="section-title">{content.lang.settings.degree}</h2>
			<div class="loading-state" role="status">
				<span class="h-5 w-5 shrink-0" aria-hidden="true"><Spinner /></span>
				<span>{content.lang.common.loading}</span>
			</div>
		</section>
	{:then catalogs}
		<DegreeSection
			{catalogs}
			{userDegree}
			{userPath}
			{onChange}
			onReset={() => {}}
			recommended={undefined}
			bind:buttonNamespace
		/>
	{/await}

	{#if userDegree !== undefined}
		<SemesterSection
			{semesterChoice}
			{totalSemestersChoice}
			{validTotalValues}
			bind:buttonNamespace
		/>
	{/if}
	{#if userDegree !== undefined && user.d.semesters.flat().length === 0}
		<UploadSection {getCourseData} bind:buttonNamespace />
	{/if}
	{#if user.d.exemptions.length > 0}
		<section class="exemptions-section">
			<h2 class="section-title">{content.lang.settings.exemptions}</h2>
			<CourseRow {getCourseData} courses={user.d.exemptions} indent={0}>
				{#snippet children({ code, course })}
					<a class="block" href={`/app/course/${code}`}>
						<CourseElement {code} {course} />
					</a>
				{/snippet}
			</CourseRow>
		</section>
	{/if}
</div>

<style>
	.settings-page {
		display: grid;
		max-inline-size: 48rem;
		gap: 0.875rem;
		text-align: start;
	}
	.account-section,
	.loading-section,
	.exemptions-section {
		min-inline-size: 0;
		padding-block-start: 0.75rem;
	}
	.account-section {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.account-identity,
	.account-action {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.account-identity {
		min-inline-size: 0;
	}
	.account-identity h2 {
		overflow-wrap: anywhere;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.sign-in-error {
		flex-basis: 100%;
		overflow-wrap: anywhere;
		font-size: 0.875rem;
	}
	.section-title {
		margin-block-end: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.4;
	}
	.loading-state {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: rgb(var(--color-content-secondary));
		font-size: 0.875rem;
	}
</style>
