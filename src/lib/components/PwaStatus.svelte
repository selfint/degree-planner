<script lang="ts">
	import PwaStatusView from './PwaStatusView.svelte';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { version } from '$app/environment';
	import {
		subscribeOfflinePublicData,
		prepareOfflinePublicData,
		type OfflinePublicDataState
	} from '$lib/offlineData';
	import {
		prepareOfflineShell,
		prepareWithReconnectRetry,
		type ShellReadiness
	} from '$lib/pwa/shell-readiness';
	import { replacesExistingWorker } from '$lib/pwa/service-worker-update';

	let showPreparing = $state(false);
	let updateReady = $state(false);
	let shell = $state<ShellReadiness>('preparing');
	let publicData = $state<OfflinePublicDataState>({
		phase: 'idle',
		courseCount: 0
	});
	let retryOffline = () => {};
	let verifyShell = () => {};
	const allReady = $derived(shell === 'ready' && publicData.phase === 'ready');
	const unavailable = $derived(
		shell === 'unavailable' || publicData.phase === 'error'
	);

	// Routine cache checks usually finish immediately. Do not flash a new row
	// above the page on every navigation or tab-focus change.
	$effect(() => {
		showPreparing = false;
		if (allReady || unavailable || shell === 'outdated') return;
		const timer = setTimeout(() => (showPreparing = true), 750);
		return () => clearTimeout(timer);
	});

	afterNavigate(() => verifyShell());

	onMount(() => {
		let disposed = false;
		let checking = false;
		let checkGeneration = 0;
		async function upgradeLegacyScope() {
			if (disposed || shell !== 'ready' || publicData.phase !== 'ready') return;
			const controller = navigator.serviceWorker?.controller;
			if (!controller) return;
			// Generic ready can refer to the old root registration. Both the
			// exact console shell and its public data must be durably usable.
			try {
				const registration = await navigator.serviceWorker.getRegistration(
					location.href
				);
				if (
					registration?.scope !== `${location.origin}/app/` ||
					registration.active !== controller
				)
					return;
				for (const old of await navigator.serviceWorker.getRegistrations()) {
					if (
						disposed ||
						shell !== 'ready' ||
						publicData.phase !== 'ready' ||
						navigator.serviceWorker.controller !== controller
					)
						return;
					if (
						old.scope === `${location.origin}/` &&
						old.active?.scriptURL === `${location.origin}/service-worker.js`
					) {
						await navigator.serviceWorker.register(
							'/legacy-service-worker.js',
							{ scope: '/', updateViaCache: 'none' }
						);
					}
				}
			} catch {
				/* Preserve the old offline registration on an uncertain transition. */
			}
		}
		const cleanups: (() => void)[] = [
			subscribeOfflinePublicData((state) => {
				publicData = state;
				void upgradeLegacyScope();
			})
		];
		const checkShell = async () => {
			if (disposed || checking) return;
			const controller = navigator.serviceWorker?.controller;
			if (!controller) return;
			const generation = ++checkGeneration;
			checking = true;
			shell = 'preparing';
			const result = await prepareWithReconnectRetry(
				() => prepareOfflineShell(controller, version),
				() =>
					!disposed &&
					generation === checkGeneration &&
					controller === navigator.serviceWorker.controller &&
					navigator.onLine
			);
			if (disposed || generation !== checkGeneration) return;
			checking = false;
			if (controller !== navigator.serviceWorker.controller) {
				void checkShell();
				return;
			}
			shell = result;
			void upgradeLegacyScope();
		};
		verifyShell = () => {
			void checkShell();
		};
		retryOffline = () => {
			void prepareOfflinePublicData().catch(() => {});
			void checkShell();
		};
		const controllerChanged = () => {
			checkGeneration++;
			checking = false;
			shell = 'preparing';
			void checkShell();
		};
		const checkNetwork = () => {
			// Verify existing durable state offline too. Reconnect resumes a partial download.
			retryOffline();
		};
		const visible = () => {
			if (document.visibilityState === 'visible') retryOffline();
		};
		window.addEventListener('online', checkNetwork);
		window.addEventListener('offline', checkNetwork);
		window.addEventListener('pageshow', retryOffline);
		document.addEventListener('visibilitychange', visible);

		// The console layout owns initial bootstrap; reconnect/visibility refresh it.
		if (import.meta.env.PROD && 'serviceWorker' in navigator) {
			navigator.serviceWorker.addEventListener(
				'controllerchange',
				controllerChanged
			);
			const timer = setTimeout(() => {
				if (!disposed && !navigator.serviceWorker.controller)
					shell = 'unavailable';
			}, 30000);
			cleanups.push(() => clearTimeout(timer));
			void navigator.serviceWorker
				.register('/service-worker.js', {
					scope: '/app/',
					updateViaCache: 'none'
				})
				.then(async (registration) => {
					if (disposed) return;
					updateReady = !!registration.waiting;
					const watchInstalling = () => {
						const worker = registration.installing;
						if (!worker) return;
						const isUpdate = replacesExistingWorker(
							worker,
							registration.active,
							registration.active ? navigator.serviceWorker.controller : null
						);
						const changed = () => {
							if (worker.state === 'installed' && isUpdate) updateReady = true;
							if (worker.state === 'redundant' && !registration.active)
								shell = 'unavailable';
						};
						worker.addEventListener('statechange', changed);
						cleanups.push(() =>
							worker.removeEventListener('statechange', changed)
						);
					};
					registration.addEventListener('updatefound', watchInstalling);
					cleanups.push(() =>
						registration.removeEventListener('updatefound', watchInstalling)
					);
					watchInstalling();
					void checkShell();
					await navigator.serviceWorker.ready;
					if (!disposed) void checkShell();
				})
				.catch(() => {
					if (!disposed) shell = 'unavailable';
				});
		} else shell = 'unavailable';

		return () => {
			disposed = true;
			checkGeneration++;
			cleanups.forEach((cleanup) => cleanup());
			window.removeEventListener('online', checkNetwork);
			window.removeEventListener('offline', checkNetwork);
			window.removeEventListener('pageshow', retryOffline);
			document.removeEventListener('visibilitychange', visible);
			navigator.serviceWorker?.removeEventListener(
				'controllerchange',
				controllerChanged
			);
		};
	});
</script>

<PwaStatusView
	{allReady}
	cachedDataReady={publicData.phase === 'ready'}
	{unavailable}
	{shell}
	{showPreparing}
	{updateReady}
	refreshError={publicData.phase === 'error'
		? undefined
		: publicData.refreshError}
	setupError={publicData.error}
	onClose={() => (updateReady = false)}
	onRetry={() => retryOffline()}
/>
