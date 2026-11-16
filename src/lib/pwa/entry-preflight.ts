import { createEntryUpdate, isAppUpdateRegistration } from './entry-update';
import { createUpdateCheckScheduler } from './update-check-scheduler';
import {
	requestUpdateActivation,
	waitForUpdateController
} from './update-activation';
import { updateSafety } from './update-safety';

let checked = false;
let failed = false;
let pending: Promise<void> | undefined;
export const entryUpdateChecked = () => checked;
export const entryUpdateFailed = () => failed;

/** Settle an installed release before bootstrapping data or mounting editable UI.
 * A first install remains the mounted shell's responsibility. Later discoveries
 * stay manual; a timeout must not start another automatic entry check. */
export function prepareEntryRelease(currentVersion: string, base: string) {
	return (pending ??= prepare(currentVersion, base));
}

async function prepare(currentVersion: string, base: string) {
	if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
	let registration: ServiceWorkerRegistration | undefined;
	try {
		registration = await navigator.serviceWorker.getRegistration(location.href);
	} catch {
		return;
	}
	if (
		!registration?.active ||
		!isAppUpdateRegistration(registration, location.origin, base)
	)
		return;
	checked = true;
	const scheduler = createUpdateCheckScheduler(() => registration, { base });
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => {
		finish = resolve;
	});
	const entry = createEntryUpdate({
		currentVersion,
		finished: finish,
		failed: () => {
			failed = true;
		}
	});
	void entry.run(
		registration,
		() => scheduler.checkOnEntry(),
		async (worker, version) => {
			if (updateSafety.blocked() || registration.waiting !== worker) return;
			const controller = waitForUpdateController(
				navigator.serviceWorker,
				worker
			);
			try {
				if ((await requestUpdateActivation(worker, version)) !== 'accepted')
					return;
				await controller.promise;
				if (
					updateSafety.blocked() ||
					navigator.serviceWorker.controller !== worker
				)
					return;
				try {
					sessionStorage.setItem(
						'planit-entry-release-reload',
						JSON.stringify({ path: location.pathname, at: Date.now() })
					);
				} catch {
					/* Storage restrictions must not block a safe update. */
				}
				location.reload();
				// Keep the old document at the initial stage until navigation replaces it.
				// Otherwise finally/route resolution briefly fills it just before reload.
				await new Promise<never>(() => {});
			} finally {
				controller.dispose();
			}
		}
	);
	await finished;
	scheduler.dispose();
}
