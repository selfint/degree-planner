<script lang="ts">
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
		type ShellReadiness
	} from '$lib/pwa/shell-readiness';
	import { content } from '$lib/stores.svelte';
	import { pwaMessages } from '$lib/pwa/messages';
	import { replacesExistingWorker } from '$lib/pwa/service-worker-update';

	const text = $derived(pwaMessages[content.lang.lang]);
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
			const result = await prepareOfflineShell(controller, version);
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

<!-- Lifecycle stays mounted in the console. Ready state takes no visual space;
     only preparation, a failed setup, or an update needs an on-screen notice. -->
<div
	data-testid="pwa-status"
	data-state={allReady
		? 'ready'
		: shell === 'outdated'
			? 'outdated'
			: unavailable
				? 'error'
				: 'preparing'}
	class="text-sm text-content-secondary"
>
	<p role="status" class="sr-only start-0 top-0 m-0">
		{allReady ? text.ready : ''}
	</p>
	{#if updateReady}
		<div
			role="status"
			class="mx-3 my-2 flex items-start gap-3 rounded-md bg-card-primary p-3"
			data-testid="pwa-update"
		>
			<p class="flex-grow">{text.update}</p>
			<button
				type="button"
				class="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-lg hover:bg-background"
				aria-label={text.close}
				onclick={() => (updateReady = false)}>×</button
			>
		</div>
	{/if}
	{#if !allReady}
		{#if shell === 'outdated'}
			<p role="status" class="mx-3 my-2" data-testid="pwa-incomplete">
				{text.shellOutdated}
			</p>
		{:else if unavailable}
			<p role="status" class="mx-3 my-2" data-testid="pwa-incomplete">
				{text.unavailable}
				<button
					type="button"
					class="ms-2 min-h-11 underline"
					onclick={() => retryOffline()}>{text.retry}</button
				>
			</p>
		{:else if showPreparing}
			<p role="status" class="mx-3 my-2" data-testid="pwa-downloading">
				{text.downloading}
			</p>
		{/if}
	{/if}
</div>
