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
		content,
		setStorage,
		localStorageMethod,
		setUser
	} from '$lib/stores.svelte';

	import { planOnline } from '$lib/planAccess';
	import ConsoleAccountStatus from '$lib/components/ConsoleAccountStatus.svelte';

	import TitleBar from '../components/TitleBar.svelte';
	import AppFooter from '$lib/components/AppFooter.svelte';
	import PwaStatus from '$lib/components/PwaStatus.svelte';
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
</script>

<svelte:head>
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="PlanIt" />
</svelte:head>

<div dir={content.lang.dir} class="flex h-full min-h-screen flex-col">
	<div class="w-full border-b border-border bg-background">
		<TitleBar
			homeHref="/app/"
			started={true}
			searchQuery={searchNavigation.url.pathname === '/app/search'
				? (searchNavigation.url.searchParams.get('q') ?? '')
				: ''}
			searchRevision={searchNavigation.externalRevision}
			onSearch={searchNavigation.search}
		/>
	</div>

	<PwaStatus />

	<ConsoleAccountStatus
		readOnly={!$planOnline}
		{offline}
		{authPending}
		{cloudPlanBlocked}
		onRetry={() => retryAccount()}
		onSignOut={() => firebase.auth.signOut()}
	/>

	<main class="flex-grow" class:hidden={planBlocked} inert={planBlocked}>
		{@render children()}
	</main>

	<AppFooter />
</div>

<style lang="postcss">
	@reference "tailwindcss";

	:global(body) {
		@apply bg-background;
		overscroll-behavior-y: none;
	}
</style>
