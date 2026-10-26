/** Browser-owned registration/navigation checks can still happen independently. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
export const UPDATE_CHECK_STORAGE_KEY = 'planit:pwa:update-check:/app/';
const CHECK_LOCK = UPDATE_CHECK_STORAGE_KEY;
export const UPDATE_CHECK_TIMEOUT_MS = 30_000;
const COORDINATION_RETRY_MS = 60_000;

type CheckRecord = { lastAttemptAt: number; lastCheckedAt?: number };
type UpdateRegistration = Pick<ServiceWorkerRegistration, 'scope' | 'update'> &
	Partial<Pick<ServiceWorkerRegistration, 'active' | 'waiting' | 'installing'>>;
type SchedulerWindow = Pick<
	Window,
	'addEventListener' | 'removeEventListener' | 'localStorage' | 'location'
> & { navigator: Pick<Navigator, 'onLine'> & { locks?: LockManager } };
type SchedulerDocument = Pick<
	Document,
	'addEventListener' | 'removeEventListener' | 'visibilityState'
>;

/** Check for a waiting update, never activate it or reload any document.
 * Attempts (including failures) are limited to one per hour. Offline/hidden
 * skips consume no attempt. A resolved update records success separately; it
 * does not mean a new version exists, or that its offline shell is ready. */
export function createUpdateCheckScheduler(
	getRegistration: () => UpdateRegistration | undefined,
	{
		window: win = window,
		document: doc = document,
		now = Date.now
	}: {
		window?: SchedulerWindow;
		document?: SchedulerDocument;
		now?: () => number;
	} = {}
) {
	let disposed = false;
	let checking = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let memoryRecord: CheckRecord | undefined;
	let coordinationRetryAt = 0;
	let locksUnavailable = false;
	let cancelPending: (() => void) | undefined;
	const expectedScope = `${win.location.origin}/app/`;

	function readRecord(): CheckRecord | undefined {
		let stored: CheckRecord | undefined;
		try {
			const raw = win.localStorage.getItem(UPDATE_CHECK_STORAGE_KEY);
			if (raw !== null) {
				const value = JSON.parse(raw);
				if (value && typeof value === 'object') stored = value;
			}
		} catch {
			// Private/blocked storage still gets an in-memory per-page throttle.
		}
		const time = now();
		return validTimestamp(memoryRecord?.lastAttemptAt, time) &&
			(!validTimestamp(stored?.lastAttemptAt, time) ||
				memoryRecord.lastAttemptAt > stored.lastAttemptAt ||
				(memoryRecord.lastAttemptAt === stored.lastAttemptAt &&
					(memoryRecord.lastCheckedAt ?? 0) > (stored.lastCheckedAt ?? 0)))
			? memoryRecord
			: stored;
	}
	function writeRecord(record: CheckRecord) {
		memoryRecord = record;
		try {
			win.localStorage.setItem(
				UPDATE_CHECK_STORAGE_KEY,
				JSON.stringify(record)
			);
		} catch {
			// Checking for an update must not depend on storage permission.
		}
	}
	function validTimestamp(value: unknown, time: number): value is number {
		return (
			typeof value === 'number' &&
			Number.isFinite(value) &&
			value > 0 &&
			value <= time
		);
	}
	function remaining(time: number) {
		const attempt = readRecord()?.lastAttemptAt;
		const coordinationWait = Math.max(0, coordinationRetryAt - time);
		if (coordinationWait > COORDINATION_RETRY_MS) coordinationRetryAt = 0;
		// A backwards clock change or corrupt/future stored value must not
		// suppress checks indefinitely. The next attempt repairs the record.
		return Math.max(
			coordinationRetryAt > 0 ? Math.max(0, coordinationRetryAt - time) : 0,
			validTimestamp(attempt, time)
				? Math.max(0, UPDATE_CHECK_INTERVAL_MS - (time - attempt))
				: 0
		);
	}
	function eligible() {
		const registration = getRegistration();
		const newestWorker =
			registration?.installing ?? registration?.waiting ?? registration?.active;
		return (
			!disposed &&
			win.location.pathname.startsWith('/app/') &&
			registration?.scope === expectedScope &&
			(!newestWorker ||
				newestWorker.scriptURL ===
					`${win.location.origin}/service-worker.js`) &&
			doc.visibilityState === 'visible' &&
			win.navigator.onLine
		);
	}
	function schedule() {
		clearTimeout(timer);
		timer = undefined;
		if (!eligible() || checking) return;
		// Reevaluate periodically even if the wall clock moved backwards. No
		// network request is made while the persisted attempt remains recent.
		timer = setTimeout(refresh, Math.max(1, remaining(now())));
	}
	function updateWithTimeout(registration: UpdateRegistration) {
		return new Promise<boolean>((resolve) => {
			let settled = false;
			const finish = (success: boolean) => {
				if (settled) return;
				settled = true;
				clearTimeout(timeout);
				cancelPending = undefined;
				resolve(success);
			};
			const timeout = setTimeout(() => finish(false), UPDATE_CHECK_TIMEOUT_MS);
			cancelPending = () => finish(false);
			try {
				void registration.update().then(
					() => finish(true),
					() => finish(false)
				);
			} catch {
				finish(false);
			}
		});
	}
	async function coordinate(action: () => void): Promise<boolean> {
		let invoked = false;
		const run = () => {
			invoked = true;
			if (!disposed) action();
		};
		try {
			const locks = locksUnavailable ? undefined : win.navigator.locks;
			if (!locks) {
				run();
				return true;
			}
			return await locks.request(CHECK_LOCK, { ifAvailable: true }, (lock) => {
				if (!lock) return false;
				run();
				return true;
			});
		} catch {
			// Some browsers expose Web Locks but deny access in this context.
			// Degrade to the existing best-effort storage/memory throttle, but
			// never repeat an action whose lock callback already ran.
			if (invoked) return false;
			locksUnavailable = true;
			try {
				run();
				return true;
			} catch {
				return false;
			}
		}
	}
	function claimIfDue() {
		if (!eligible() || remaining(now()) > 0) return;
		const registration = getRegistration();
		if (!registration) return;
		const startedAt = now();
		const previous = readRecord();
		writeRecord({
			lastAttemptAt: startedAt,
			lastCheckedAt: validTimestamp(previous?.lastCheckedAt, startedAt)
				? previous.lastCheckedAt
				: undefined
		});
		return { registration, startedAt };
	}
	function refresh() {
		clearTimeout(timer);
		timer = undefined;
		if (!eligible() || checking) return;
		if (remaining(now()) > 0) {
			schedule();
			return;
		}
		checking = true;
		// The lock makes the storage read/claim atomic across supported tabs.
		// Do not hold it across the network: a stalled browser update must not
		// lock other tabs forever. Without Web Locks, sharing the persisted
		// attempt is best-effort deduplication, not an activation safety lock.
		let attempt: ReturnType<typeof claimIfDue>;
		void coordinate(() => {
			attempt = claimIfDue();
		})
			.then(async (claimed) => {
				if (!claimed) coordinationRetryAt = now() + COORDINATION_RETRY_MS;
				if (!attempt || disposed) return;
				const { registration, startedAt } = attempt;
				const success = await updateWithTimeout(registration);
				if (success && !disposed) {
					await coordinate(() => {
						const latest = readRecord();
						// Never overwrite a newer tab's attempt with a late completion.
						if (latest?.lastAttemptAt === startedAt)
							writeRecord({ ...latest, lastCheckedAt: now() });
					});
				}
				// Failures/timeouts leave last success untouched and retry after an hour.
			})
			.finally(() => {
				checking = false;
				schedule();
			});
	}
	const storageChanged = (event: Event) => {
		const { key } = event as StorageEvent;
		if (key === UPDATE_CHECK_STORAGE_KEY || key === null) refresh();
	};
	const windowEvents = ['online', 'offline', 'focus', 'pageshow'] as const;
	for (const event of windowEvents) win.addEventListener(event, refresh);
	doc.addEventListener('visibilitychange', refresh);
	win.addEventListener('storage', storageChanged);
	refresh();
	return {
		refresh,
		dispose() {
			disposed = true;
			clearTimeout(timer);
			cancelPending?.();
			for (const event of windowEvents) win.removeEventListener(event, refresh);
			doc.removeEventListener('visibilitychange', refresh);
			win.removeEventListener('storage', storageChanged);
		}
	};
}
