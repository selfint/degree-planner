<script lang="ts">
	let { offline = false }: { offline?: boolean } = $props();
	import PwaStatusView from './PwaStatusView.svelte';
	import { updateSafety } from '$lib/pwa/update-safety';
	import {
		requestUpdateActivation,
		waitForUpdateController
	} from '$lib/pwa/update-activation';
	import { pwaMessages } from '$lib/pwa/messages';
	import { content } from '$lib/preferences.svelte';
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
	import { publishOfflineShellStatus } from '$lib/pwa/status';
	import {
		readWaitingWorkerVersion,
		createUpdateVersionReader,
		hasWaitingUpdate
	} from '$lib/pwa/service-worker-update';

	let updateBusy = $state(false);
	let updateActionError = $state<string>();
	let acceptedUpdate = $state<{ worker: ServiceWorker; version: string }>();
	let acceptUpdate = () => {};
	let showPreparing = $state(false);
	let updateReady = $state(false);
	let updateVersion = $state<string | undefined>();
	let updateVersionError = $state<string | undefined>();
	let shell = $state<ShellReadiness>('preparing');
	let shellError = $state<string | undefined>();
	function setShell(status: ShellReadiness, error?: string) {
		shell = status;
		if (status === 'ready' || status === 'outdated') shellError = undefined;
		else if (error) shellError = error;
	}
	$effect(() => {
		publishOfflineShellStatus({
			status: shell,
			updateReady: updateReady || !!acceptedUpdate,
			updateVersion: acceptedUpdate?.version ?? updateVersion,
			updateBlocked: $updateSafety,
			updateBusy,
			updateActionError,
			acceptUpdate: () => acceptUpdate(),
			updateVersionError,
			error: shellError
		});
	});
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
			setShell('preparing');
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
			setShell(
				result,
				result === 'unavailable'
					? 'Offline app files could not be verified. Check your connection and retry.'
					: undefined
			);
			void upgradeLegacyScope();
		};
		verifyShell = () => {
			void checkShell();
		};
		retryOffline = () => {
			void prepareOfflinePublicData();
			if (shell === 'unavailable' || !navigator.serviceWorker?.controller)
				void registerShell();
			else void checkShell();
		};
		const controllerChanged = () => {
			reconcileUpdateReady();
			checkGeneration++;
			checking = false;
			setShell('preparing');
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

		// The console layout owns data bootstrap. Retry a failed platform setup too,
		// without activating a waiting worker or replacing the current document.
		let registering = false;
		let currentRegistration: ServiceWorkerRegistration | undefined;
		let reloadStarted = false;
		acceptUpdate = async () => {
			if (disposed || updateBusy || reloadStarted || updateSafety.blocked())
				return;
			updateBusy = true;
			updateActionError = undefined;
			let controllerWait:
				| ReturnType<typeof waitForUpdateController>
				| undefined;
			let target: ServiceWorker | undefined;
			let targetVersion: string | undefined;
			try {
				target =
					acceptedUpdate?.worker ?? currentRegistration?.waiting ?? undefined;
				targetVersion = acceptedUpdate?.version ?? updateVersion;
				if (!target || !targetVersion)
					throw new Error('No verified update is available.');
				if (target !== navigator.serviceWorker.controller) {
					if (
						currentRegistration?.waiting !== target ||
						target.state !== 'installed'
					)
						throw new Error('The waiting update changed.');
					const verifiedVersion = await readWaitingWorkerVersion(target);
					if (
						verifiedVersion !== targetVersion ||
						currentRegistration?.waiting !== target
					)
						throw new Error('The waiting update changed.');
					if (disposed || updateSafety.blocked())
						throw new Error('Save changes before updating.');
					controllerWait = waitForUpdateController(
						navigator.serviceWorker,
						target
					);
					const status = await requestUpdateActivation(target, targetVersion);
					if (status !== 'accepted') {
						updateActionError =
							status === 'other-tabs'
								? pwaMessages[content.lang.lang].updateOtherTabs
								: pwaMessages[content.lang.lang].updateFailed;
						return;
					}
					acceptedUpdate = { worker: target, version: targetVersion };
					await controllerWait.promise;
				}
				// The user may have edited while activation was pending. Never reload that
				// draft; retain an explicit retry action for this already-active version.
				if (disposed || updateSafety.blocked()) {
					updateActionError = pwaMessages[content.lang.lang].updateBlocked;
					return;
				}
				if (navigator.serviceWorker.controller !== target)
					throw new Error('The controlling update changed.');
				reloadStarted = true;
				window.location.reload();
			} catch {
				if (
					target &&
					targetVersion &&
					navigator.serviceWorker.controller === target
				)
					acceptedUpdate = { worker: target, version: targetVersion };
				updateActionError = pwaMessages[content.lang.lang].updateFailed;
			} finally {
				controllerWait?.dispose();
				updateBusy = false;
			}
		};
		let controllerTimer: ReturnType<typeof setTimeout> | undefined;
		const watchedRegistrations = new WeakSet<ServiceWorkerRegistration>();
		const watchedWorkers = new WeakSet<ServiceWorker>();
		const versionReader = createUpdateVersionReader(
			() =>
				currentRegistration &&
				hasWaitingUpdate(
					currentRegistration.waiting,
					currentRegistration.active
				)
					? currentRegistration.waiting
					: null,
			({ version, error }) => {
				updateVersion = version;
				updateVersionError = error;
			}
		);
		cleanups.push(() => versionReader.dispose());
		function reconcileUpdateReady() {
			if (disposed) return;
			updateReady = currentRegistration
				? hasWaitingUpdate(
						currentRegistration.waiting,
						currentRegistration.active
					)
				: false;
			versionReader.reconcile();
		}
		function watchWorker(
			registration: ServiceWorkerRegistration,
			worker: ServiceWorker | null
		) {
			if (!worker || watchedWorkers.has(worker)) return;
			watchedWorkers.add(worker);
			const changed = () => {
				if (disposed) return;
				reconcileUpdateReady();
				if (
					registration === currentRegistration &&
					worker.state === 'redundant' &&
					!registration.active
				)
					setShell(
						'unavailable',
						'The offline app installation did not finish.'
					);
			};
			worker.addEventListener('statechange', changed);
			cleanups.push(() => worker.removeEventListener('statechange', changed));
		}
		async function registerShell() {
			if (disposed || registering) return;
			if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
				setShell(
					'unavailable',
					'Service workers are unavailable in this browser.'
				);
				return;
			}
			registering = true;
			try {
				const registration = await navigator.serviceWorker.register(
					'/service-worker.js',
					{ scope: '/app/', updateViaCache: 'none' }
				);
				if (disposed) return;
				if (!registration)
					throw new Error(
						'The browser did not return an offline app registration. Allow service workers, then retry.'
					);
				currentRegistration = registration;
				reconcileUpdateReady();
				watchWorker(registration, registration.waiting);
				if (!watchedRegistrations.has(registration)) {
					watchedRegistrations.add(registration);
					const watchInstalling = () => {
						watchWorker(registration, registration.installing);
						reconcileUpdateReady();
					};
					registration.addEventListener('updatefound', watchInstalling);
					cleanups.push(() =>
						registration.removeEventListener('updatefound', watchInstalling)
					);
					watchInstalling();
				}
				clearTimeout(controllerTimer);
				controllerTimer = setTimeout(() => {
					if (!disposed && !navigator.serviceWorker.controller)
						setShell(
							'unavailable',
							'The offline app did not take control within 30 seconds.'
						);
				}, 30000);
				void checkShell();
				void navigator.serviceWorker.ready.then(() => {
					if (!disposed) void checkShell();
				});
			} catch (error) {
				if (!disposed)
					setShell(
						'unavailable',
						error instanceof Error ? error.message : String(error)
					);
			} finally {
				registering = false;
			}
		}
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.addEventListener(
				'controllerchange',
				controllerChanged
			);
			cleanups.push(() => clearTimeout(controllerTimer));
		}
		void registerShell();

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
	{offline}
	{allReady}
	cachedDataReady={publicData.phase === 'ready'}
	{unavailable}
	{shell}
	{showPreparing}
	{updateReady}
	refreshError={publicData.phase === 'error'
		? undefined
		: publicData.refreshError}
	setupError={publicData.error ?? shellError}
	onRetry={() => retryOffline()}
/>
