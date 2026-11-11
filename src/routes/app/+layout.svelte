<script lang="ts">
	import { analyticsEnabled, isStaging } from '$lib/deploymentEnvironment';
	import { resolve } from '$app/paths';
	import { withBase, withoutBase } from '$lib/deploymentPaths';
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
		browserShareDestination,
		consolePathname,
		navigateFromBrowserShare
	} from '$lib/browserShareRoutes';
	import {
		createSearchNavigation,
		searchNavigationContext
	} from '$lib/searchNavigation.svelte';

	const searchNavigation = createSearchNavigation(
		() => page.url,
		(url) =>
			navigateFromBrowserShare(url, (destination) => {
				const target = new URL(destination, page.url);
				// The URL already includes the deployment base. Resolve its pathname
				// exactly once, then preserve the query and fragment without parsing
				// them as route parameters.
				let route: string = resolve(
					`/${withoutBase(target.pathname).slice(1)}`
				);
				route += target.search + target.hash;
				return goto(route, { noScroll: true, keepFocus: true });
			})
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
	import PwaStatusDetails from '$lib/components/PwaStatusDetails.svelte';
	import PwaUpdateBanner from '$lib/components/PwaUpdateBanner.svelte';
	import { offlineShellStatus } from '$lib/pwa/status';
	// Browser share previews reuse this layout outside the worker's scope.
	const inPwaScope = $derived(page.url.pathname.startsWith(withBase('/app/')));
	import {
		buildFirebaseStorage,
		subscribeFirebase,
		startOptionalAnalytics
	} from '$lib/firebase.svelte';

	onMount(() => {
		let cancelled = false;
		const timer = setTimeout(() => {
			if (!analyticsEnabled || cancelled || !navigator.onLine) return;
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

	let entryPending = $state(true);
	let entryError = $state(false);
	let authReady = $state(false);
	let offline = $state(false);
	let signedIn = $state(false);
	let accountState = $state<'loading' | 'ready' | 'failed'>('loading');
	const cloudPlanUnavailable = $derived(accountState !== 'ready');
	let retryAccount = () => {};
	const plannerRoute = $derived(
		/^\/app\/(plan|settings|catalog|semester|preview)(\/|$)/.test(
			consolePathname(page.url.pathname)
		)
	);
	const cloudPlanBlocked = $derived(
		plannerRoute && signedIn && (offline || accountState === 'failed')
	);
	const authPending = $derived(
		plannerRoute &&
			(!authReady || (signedIn && !offline && accountState === 'loading'))
	);
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
			accountState = 'loading';
			stopSnapshot?.();
			stopSnapshot = undefined;
			try {
				const data = await storage.read();
				if (current !== generation) return;
				setUser(data);
				accountState = 'ready';
				stopSnapshot = subscribeFirebase(firebase, (data) => {
					if (current === generation) setUser(data);
				});
			} catch {
				if (current !== generation) return;
				accountState = 'failed';
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
			if (!offline && firebase.auth.currentUser && accountState !== 'ready')
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
				accountState = 'ready';
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
	<link rel="manifest" href={withBase('/manifest.webmanifest')} />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta
		name="apple-mobile-web-app-title"
		content={isStaging ? 'PlanIt Staging' : 'PlanIt'}
	/>
</svelte:head>

{#if inPwaScope && entryError && !entryPending}
	<p role="alert" class="text-center text-sm" data-testid="pwa-entry-error">
		{content.lang.lang === 'he'
			? 'לא ניתן לבדוק עדכונים. אפשר להמשיך להשתמש בגרסה הנוכחית.'
			: 'Could not check for updates. You can keep using this version.'}
	</p>
{/if}

{#if inPwaScope && entryPending}
	<!-- The visible shell remains inert while an entry update may activate. -->
	<p class="sr-only" role="status">
		{content.lang.lang === 'he' ? 'בודקים עדכונים…' : 'Checking for updates…'}
	</p>
{/if}

<div
	dir={content.lang.dir}
	data-sveltekit-reload={browserShareDestination(page.url.pathname)
		? true
		: undefined}
	class="console-shell flex h-full min-h-screen flex-col"
	inert={inPwaScope && entryPending}
	aria-busy={inPwaScope && entryPending}
>
	<div class="w-full border-b border-border bg-background">
		<TitleBar
			started={true}
			searchQuery={searchNavigation.url.pathname === withBase('/app/search')
				? (searchNavigation.url.searchParams.get('q') ?? '')
				: ''}
			searchRevision={searchNavigation.externalRevision}
			onSearch={searchNavigation.search}
		/>
	</div>

	{#if inPwaScope && entryPending}
		<div class="entry-update-slot">
			<p
				class="entry-update-status"
				aria-hidden="true"
				data-testid="pwa-entry-update"
			>
				{content.lang.lang === 'he'
					? 'בודקים עדכונים…'
					: 'Checking for updates…'}
			</p>
		</div>
	{/if}

	{#if inPwaScope}
		<PwaUpdateBanner
			visible={$offlineShellStatus.updateReady}
			updateVersion={$offlineShellStatus.updateVersion}
			updateVersionError={$offlineShellStatus.updateVersionError}
			updateBlocked={$offlineShellStatus.updateBlocked}
			updateBusy={$offlineShellStatus.updateBusy}
			updateActionError={$offlineShellStatus.updateActionError}
			onAccept={$offlineShellStatus.acceptUpdate}
		/>
	{/if}

	<div class:flex-grow={planBlocked}>
		<ConsoleAccountStatus
			readOnly={!$planOnline}
			{offline}
			{authPending}
			{cloudPlanBlocked}
			onRetry={() => retryAccount()}
			onSignOut={() => firebase.auth.signOut()}
		/>
	</div>

	<main class="flex-grow" class:hidden={planBlocked} inert={planBlocked}>
		{@render children()}
	</main>

	{#snippet pwaControls()}
		<div class="pwa-footer-controls">
			<PwaStatus
				{offline}
				onEntryFinished={() => (entryPending = false)}
				onEntryError={() => (entryError = true)}
			/>
		</div>
		<PwaStatusDetails />
	{/snippet}
	<AppFooter
		compact
		update={inPwaScope ? $offlineShellStatus : undefined}
		pwa={inPwaScope ? pwaControls : undefined}
	/>
</div>

<style lang="postcss">
	@reference "tailwindcss";
	.entry-update-slot {
		min-block-size: 1.5rem;
		flex: none;
	}
	.entry-update-status {
		margin: 0;
		padding: 0.125rem 1rem;
		font-size: 0.75rem;
		line-height: 1.25rem;
		color: rgb(var(--color-content-secondary));
		text-align: center;
	}

	.pwa-footer-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem 0.75rem;
		min-inline-size: 0;
	}
	:global(body) {
		@apply bg-background;
		overscroll-behavior-y: none;
	}
</style>
