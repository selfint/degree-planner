import { readWaitingWorkerVersion } from './service-worker-update';
import {
	requestUpdateActivation,
	waitForUpdateController
} from './update-activation';

/** No app state or draft lives in this document. The worker's version-bound,
 * sole-client protocol protects all other app windows. */
export function mountShellRecovery(
	readVersion: typeof readWaitingWorkerVersion,
	activate: typeof requestUpdateActivation,
	waitForController: typeof waitForUpdateController
) {
	let language: 'en' | 'he' = 'he';
	let theme = 'dark';
	try {
		language = localStorage.getItem('lang') === 'en' ? 'en' : 'he';
		theme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
	} catch {
		/* Match the app defaults when preference storage is unavailable. */
	}
	const copy =
		language === 'en'
			? {
					title: 'PlanIt could not open this version',
					description:
						'The installed app files are unavailable. Your saved plans have not been removed. Try again, or update the installed app.',
					update: 'Update installed app',
					retry: 'Try again',
					busy: 'Preparing update…',
					otherTabs:
						'Save your work in other PlanIt windows and close them, then try again.',
					failed:
						'The update could not finish. Connect to the internet and try again. Your saved plans have not been removed.'
				}
			: {
					title: 'לא ניתן לפתוח את הגרסה המותקנת',
					description:
						'קובצי היישום המותקן אינם זמינים. התוכניות השמורות לא נמחקו. נסו שוב או עדכנו את היישום המותקן.',
					update: 'עדכון היישום המותקן',
					retry: 'נסו שוב',
					busy: 'מכינים את העדכון…',
					otherTabs:
						'שמרו את העבודה בחלונות האחרים של PlanIt וסגרו אותם, ואז נסו שוב.',
					failed:
						'העדכון לא הושלם. התחברו לאינטרנט ונסו שוב. התוכניות השמורות לא נמחקו.'
				};
	document.documentElement.lang = language;
	document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
	document.documentElement.dataset.theme = theme;
	document.title = copy.title;
	document.getElementById('recovery-title')!.textContent = copy.title;
	document.getElementById('recovery-description')!.textContent =
		copy.description;
	document.getElementById('recovery-retry')!.textContent = copy.retry;
	const button = document.getElementById('recover-app') as HTMLButtonElement;
	button.textContent = copy.update;
	const status = document.getElementById('recovery-status')!;
	let accepted: ServiceWorker | undefined;
	button.addEventListener('click', async () => {
		if (button.disabled) return;
		button.disabled = true;
		status.textContent = copy.busy;
		button.setAttribute('aria-busy', 'true');
		let target: ServiceWorker | undefined;
		let wait: ReturnType<typeof waitForUpdateController> | undefined;
		try {
			const container = navigator.serviceWorker;
			if (accepted && container.controller === accepted) {
				location.reload();
				return;
			}
			const registration = await container.getRegistration(location.href);
			if (!registration) throw new Error('No installed app registration.');
			// Never wait for the network when a usable waiting build already exists.
			if (!registration.waiting) {
				let timer: ReturnType<typeof setTimeout> | undefined;
				try {
					await Promise.race([
						registration.update(),
						new Promise<never>((_, reject) => {
							timer = setTimeout(
								() => reject(new Error('Update check timed out.')),
								10000
							);
						})
					]);
				} finally {
					clearTimeout(timer);
				}
			}
			const installing = registration.installing;
			if (!registration.waiting && installing) {
				await new Promise<void>((resolve, reject) => {
					const finish = (error?: Error) => {
						clearTimeout(timer);
						installing.removeEventListener('statechange', changed);
						if (error) reject(error);
						else resolve();
					};
					const changed = () => {
						if (installing.state === 'installed') finish();
						else if (installing.state === 'redundant')
							finish(new Error('Installation failed.'));
					};
					const timer = setTimeout(
						() => finish(new Error('Installation timed out.')),
						30000
					);
					installing.addEventListener('statechange', changed);
					changed();
				});
			}
			target = registration.waiting ?? undefined;
			if (!target || target.state !== 'installed')
				throw new Error('No update is ready.');
			const version = await readVersion(target);
			if (registration.waiting !== target)
				throw new Error('The waiting update changed.');
			wait = waitForController(container, target);
			const result = await activate(target, version);
			if (result === 'other-tabs') {
				status.textContent = copy.otherTabs;
				return;
			}
			if (result !== 'accepted')
				throw new Error('The update could not be accepted.');
			accepted = target;
			await wait.promise;
			if (container.controller !== target)
				throw new Error('The controller changed.');
			location.reload();
		} catch (error) {
			console.warn('PlanIt installed-app recovery failed', error);
			if (target && navigator.serviceWorker.controller === target)
				accepted = target;
			status.textContent = copy.failed;
		} finally {
			wait?.dispose();
			button.disabled = false;
			button.setAttribute('aria-busy', 'false');
		}
	});
}

/** Embed self-contained protocol clients, never a newer app bundle. These
 * compiled functions must have no module-scoped runtime dependencies. */
export function shellRecoveryScript() {
	return `(${mountShellRecovery.toString()})(${readWaitingWorkerVersion.toString()},${requestUpdateActivation.toString()},${waitForUpdateController.toString()});`;
}
