<script lang="ts">
	import {
		afterNavigate,
		beforeNavigate,
		goto,
		onNavigate
	} from '$app/navigation';
	import { onMount, setContext } from 'svelte';
	import {
		PERSONAL_PLAN_READY,
		canShowPersonalPlan
	} from '$lib/pwa/plan-visibility';
	import { page } from '$app/state';
	import {
		createSearchNavigation,
		searchNavigationContext
	} from '$lib/searchNavigation.svelte';

	const searchNavigation = createSearchNavigation(
		() => page.url,
		(url) => goto(url, { noScroll: true, keepFocus: true })
	);
	setContext(searchNavigationContext, searchNavigation);
	beforeNavigate(({ to, type }) =>
		searchNavigation.observeNavigation(to?.url, type)
	);
	// Kit can skip beforeNavigate during an existing navigation. onNavigate runs
	// before teardown/focus emits blur; afterNavigate releases the draft guard.
	onNavigate(({ to, type }) =>
		searchNavigation.observeNavigation(to?.url, type)
	);
	afterNavigate(({ to, type }) =>
		searchNavigation.observeNavigation(to?.url, type, true)
	);

	import {
		user,
		content,
		setStorage,
		localStorageMethod,
		setUser
	} from '$lib/stores.svelte';

	import { cms } from '$lib/content';
	import { planOnline } from '$lib/planAccess';
	import { pwaMessages } from '$lib/pwa/messages';

	import TitleBar from '../components/TitleBar.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import PwaStatus from '$lib/components/PwaStatus.svelte';
	import Select from '$lib/components/Select.svelte';
	import {
		buildFirebaseStorage,
		subscribeFirebase,
		startOptionalAnalytics
	} from '$lib/firebase.svelte';

	onMount(() => {
		let cancelled = false;
		const timer = setTimeout(() => {
			if (cancelled || !navigator.onLine) return;
			void startOptionalAnalytics(firebase);
			void import('@vercel/analytics')
				.then(({ inject }) => {
					if (!cancelled) inject();
				})
				.catch(() => {});
			void import('@vercel/speed-insights/sveltekit')
				.then(({ injectSpeedInsights }) => {
					if (!cancelled) injectSpeedInsights();
				})
				.catch(() => {});
		}, 1500);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	const { data: pageData, children } = $props();
	const { firebase } = $derived(pageData);

	let authReady = $state(false);
	let offline = $state(false);
	let signedIn = $state(false);
	let cloudPlanUnavailable = $state(false);
	let retryAccount = () => {};
	const plannerRoute = $derived(
		/^\/app\/(plan|settings|catalog|semester|preview)(\/|$)/.test(
			page.url.pathname
		)
	);
	const cloudPlanBlocked = $derived(
		plannerRoute && signedIn && (offline || cloudPlanUnavailable)
	);
	const authPending = $derived(plannerRoute && !authReady);
	const planBlocked = $derived(authPending || cloudPlanBlocked);
	setContext(PERSONAL_PLAN_READY, () =>
		canShowPersonalPlan({ authReady, signedIn, offline, cloudPlanUnavailable })
	);

	$effect(() => {
		authReady = false;
		let generation = 0;
		let stopSnapshot: (() => void) | undefined;

		async function loadAccount() {
			const current = ++generation;
			const storage = buildFirebaseStorage(firebase);
			setStorage(storage);
			cloudPlanUnavailable = true;
			try {
				const data = await storage.read();
				if (current !== generation) return;
				setUser(data);
				cloudPlanUnavailable = false;
				stopSnapshot?.();
				stopSnapshot = subscribeFirebase(firebase, (data) => {
					if (current === generation) setUser(data);
				});
			} catch {
				// Never expose the initially loaded guest plan as the account plan.
				// Keep existing components mounted so a connection change cannot
				// discard an in-memory draft. Retry account loading on reconnect.
			}
		}

		retryAccount = () => {
			if (firebase.auth.currentUser) void loadAccount();
		};
		const connectionChanged = () => {
			offline = !navigator.onLine;
			if (!offline && firebase.auth.currentUser && cloudPlanUnavailable)
				void loadAccount();
		};
		offline = !navigator.onLine;
		window.addEventListener('online', connectionChanged);
		window.addEventListener('offline', connectionChanged);
		const unsubscribe = firebase.auth.onAuthStateChanged(async (u) => {
			authReady = false;
			generation++;
			stopSnapshot?.();
			stopSnapshot = undefined;
			signedIn = u !== null;
			if (u !== null) {
				authReady = true;
				await loadAccount();
			} else {
				cloudPlanUnavailable = false;
				setStorage(localStorageMethod);
				const current = generation;
				const data = await localStorageMethod.read();
				if (current === generation) {
					setUser(data);
					authReady = true;
				}
			}
		});

		return () => {
			generation++;
			unsubscribe();
			stopSnapshot?.();
			window.removeEventListener('online', connectionChanged);
			window.removeEventListener('offline', connectionChanged);
		};
	});

	function onchangeLang(newValue: (typeof cms)[keyof typeof cms]): void {
		try {
			localStorage.setItem('lang', newValue.lang);
		} catch {
			// The bound in-memory preference still works when storage is unavailable.
		}
	}
</script>

<svelte:head>
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="PlanIt" />
</svelte:head>

<div dir={content.lang.dir} class="flex h-full min-h-screen flex-col">
	<div class="w-full border-b-[1px] border-border bg-background">
		<TitleBar
			homeHref="/app/"
			started={user.d.degree !== undefined}
			searchQuery={searchNavigation.url.pathname === '/app/search'
				? (searchNavigation.url.searchParams.get('q') ?? '')
				: ''}
			searchRevision={searchNavigation.externalRevision}
			onSearch={searchNavigation.search}
		/>
	</div>

	{#if !$planOnline}
		<p
			role="status"
			class="mx-3 my-2 rounded-md bg-card-primary p-3 text-content-primary"
			data-testid="plan-read-only"
		>
			{content.lang.lang === 'he'
				? 'מצב קריאה בלבד ללא אינטרנט. אפשר לעיין בקורסים ובתוכנית השמורה; התחברו כדי לערוך או לשמור.'
				: 'Offline, read-only mode. Browse courses and your saved plan; reconnect to edit or save.'}
		</p>
	{/if}
	{#if authPending}
		<p role="status" class="m-5 flex-grow text-content-primary">
			{content.lang.common.loading}…
		</p>
	{:else if cloudPlanBlocked}
		<p
			role="status"
			class="m-5 flex-grow text-content-primary"
			data-testid="pwa-account-unavailable"
		>
			{pwaMessages[content.lang.lang].accountUnavailable}
			<button
				type="button"
				class="ms-2 underline disabled:opacity-50"
				disabled={offline}
				onclick={() => retryAccount()}
				>{pwaMessages[content.lang.lang].retry}</button
			>
			<button
				type="button"
				class="ms-2 underline"
				onclick={() => firebase.auth.signOut()}
				>{content.lang.settings.signOut}</button
			>
		</p>
	{/if}
	<main class="flex-grow" class:hidden={planBlocked} inert={planBlocked}>
		{@render children()}
	</main>

	<footer
		class="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t-2 border-border bg-background p-3 text-sm"
	>
		<PwaStatus />

		<p class="text-content-secondary sm:flex-row sm:space-x-2">
			{content.lang.footer.createdBy}
			<a
				href="https://github.com/selfint"
				target="_blank"
				class="text-link hover:text-content-primary"
			>
				{content.lang.footer.author}
			</a>
		</p>

		<div class="flex items-center gap-x-2">
			<ThemeToggle />
			<Select bind:value={content.lang} onchange={onchangeLang}>
				<option value={cms.en}>en</option>
				<option value={cms.he}>עב</option>
			</Select>
		</div>

		<div class="flex flex-row">
			<a
				target="_blank"
				href="https://github.com/selfint/degree-planner/issues/new/choose"
				class="me-2 text-content-secondary hover:text-content-primary"
			>
				{content.lang.footer.reportIssue}
			</a>
			<a
				href="https://github.com/selfint/degree-planner"
				target="_blank"
				class="text-content-secondary hover:text-content-primary"
			>
				<!-- GitHub Icon -->
				<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
					<path
						d="M12 0C5.37 0 0 5.37 0 12a12 12 0 008.19 11.46c.6.11.82-.26.82-.58v-2.12c-3.33.73-4.03-1.61-4.03-1.61-.55-1.42-1.34-1.8-1.34-1.8-1.1-.75.08-.73.08-.73 1.21.09 1.85 1.25 1.85 1.25 1.08 1.84 2.83 1.31 3.52 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 016 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.92 1.24 3.23 0 4.61-2.81 5.62-5.48 5.91.43.37.81 1.1.81 2.21v3.28c0 .33.22.7.83.58A12 12 0 0024 12c0-6.63-5.37-12-12-12z"
					/>
				</svg>
			</a>
		</div>
	</footer>
</div>

<style lang="postcss">
	@reference "tailwindcss";

	:global(body) {
		@apply bg-background;
		overscroll-behavior-y: none;
	}
</style>
