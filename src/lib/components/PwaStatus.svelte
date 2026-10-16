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

	interface InstallPrompt extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	const text = $derived(pwaMessages[content.lang.lang]);
	let prompt = $state<InstallPrompt | undefined>();
	let standalone = $state(false);
	let offline = $state(false);
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

	afterNavigate(() => verifyShell());

	onMount(() => {
		let disposed = false;
		let checking = false;
		let checkGeneration = 0;
		const cleanups: (() => void)[] = [
			subscribeOfflinePublicData((state) => {
				publicData = state;
			})
		];
		const displayMode = window.matchMedia('(display-mode: standalone)');
		const checkDisplay = () => {
			standalone =
				displayMode.matches ||
				(navigator as Navigator & { standalone?: boolean }).standalone === true;
		};
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
			offline = !navigator.onLine;
			// Verify existing durable state offline too. Reconnect resumes a partial download.
			retryOffline();
		};
		const visible = () => {
			if (document.visibilityState === 'visible') retryOffline();
		};
		const offerInstall = (event: Event) => {
			event.preventDefault();
			prompt = event as InstallPrompt;
		};
		const installed = () => {
			standalone = true;
			prompt = undefined;
		};
		checkDisplay();
		offline = !navigator.onLine;
		displayMode.addEventListener('change', checkDisplay);
		window.addEventListener('online', checkNetwork);
		window.addEventListener('offline', checkNetwork);
		window.addEventListener('pageshow', retryOffline);
		document.addEventListener('visibilitychange', visible);
		window.addEventListener('beforeinstallprompt', offerInstall);
		window.addEventListener('appinstalled', installed);

		// Sync the full course dataset and catalog index on opening, like Planit.
		void prepareOfflinePublicData().catch(() => {});
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
				.register('/service-worker.js', { updateViaCache: 'none' })
				.then(async (registration) => {
					if (disposed) return;
					updateReady = !!registration.waiting;
					const watchInstalling = () => {
						const worker = registration.installing;
						if (!worker) return;
						const changed = () => {
							if (
								worker.state === 'installed' &&
								navigator.serviceWorker.controller
							)
								updateReady = true;
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
			displayMode.removeEventListener('change', checkDisplay);
			window.removeEventListener('online', checkNetwork);
			window.removeEventListener('offline', checkNetwork);
			window.removeEventListener('pageshow', retryOffline);
			document.removeEventListener('visibilitychange', visible);
			navigator.serviceWorker?.removeEventListener(
				'controllerchange',
				controllerChanged
			);
			window.removeEventListener('beforeinstallprompt', offerInstall);
			window.removeEventListener('appinstalled', installed);
		};
	});

	async function install() {
		const pending = prompt;
		if (!pending) return;
		prompt = undefined;
		try {
			await pending.prompt();
			await pending.userChoice;
		} catch {
			// The browser menu and manual installation instructions remain available.
		}
	}
</script>

<div class="w-full text-sm text-content-secondary">
	{#if offline}
		<p role="status" class="mb-2" data-testid="pwa-offline">{text.offline}</p>
	{/if}
	{#if updateReady}
		<div
			role="status"
			class="mb-2 flex items-start gap-3"
			data-testid="pwa-update"
		>
			<p>{text.update}</p>
			<button
				type="button"
				class="shrink-0 underline"
				aria-label={text.close}
				onclick={() => (updateReady = false)}>×</button
			>
		</div>
	{/if}
	{#if allReady}
		<p role="status" class="mb-2" data-testid="pwa-ready">{text.ready}</p>
	{:else if shell === 'outdated'}
		<p role="status" class="mb-2" data-testid="pwa-incomplete">
			{text.shellOutdated}
		</p>
	{:else if unavailable}
		<p role="status" class="mb-2" data-testid="pwa-incomplete">
			{text.unavailable}
			<button
				type="button"
				class="ms-2 underline"
				onclick={() => retryOffline()}>{text.retry}</button
			>
		</p>
	{:else}
		<p role="status" class="mb-2" data-testid="pwa-downloading">
			{text.downloading}
		</p>
	{/if}
	{#if !standalone}
		<div class="flex flex-wrap items-baseline gap-3">
			{#if prompt}
				<button
					type="button"
					class="font-medium text-content-primary underline"
					onclick={install}>{text.install}</button
				>
			{/if}
			<details class="min-w-0">
				<summary class="cursor-pointer">{prompt ? 'ⓘ' : text.install}</summary>
				<p class="mt-2 max-w-3xl">{text.installHelp}</p>
				<p class="mt-2 max-w-3xl">{text.storageHelp}</p>
			</details>
		</div>
	{/if}
</div>
