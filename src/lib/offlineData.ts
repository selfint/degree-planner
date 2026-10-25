import type { DataLoadingProgress } from './consoleLoading';
import {
	preparePublicCourseData,
	readPublicCourseDataReadiness,
	readPublicDataRefreshError,
	subscribePublicDataRefreshErrors
} from './publicData';

export type OfflinePublicDataState = {
	phase: 'idle' | 'loading' | 'ready' | 'error';
	courseCount: number;
	error?: string;
	refreshError?: string;
};

let state: OfflinePublicDataState = { phase: 'idle', courseCount: 0 };
const listeners = new Set<(state: OfflinePublicDataState) => void>();
let preparing: Promise<OfflinePublicDataState> | undefined;
let latestProgress: DataLoadingProgress | undefined;
const progressListeners = new Set<(progress: DataLoadingProgress) => void>();
function publishProgress(progress: DataLoadingProgress) {
	latestProgress = progress;
	for (const listener of progressListeners) {
		try {
			listener(progress);
		} catch (error) {
			reportSubscriberError(error);
		}
	}
}
let stopRefreshSubscription: (() => void) | undefined;

export function subscribeOfflinePublicData(
	callback: (state: OfflinePublicDataState) => void
) {
	// Subscribe only while views are present. Errors remain in the source-owned
	// URL map, so remounting immediately receives the current truthful status.
	if (!stopRefreshSubscription)
		stopRefreshSubscription = subscribePublicDataRefreshErrors(() =>
			publish(state)
		);
	listeners.add(callback);
	try {
		callback(state);
	} catch (error) {
		reportSubscriberError(error);
	}
	return () => {
		listeners.delete(callback);
		if (!listeners.size) {
			stopRefreshSubscription?.();
			stopRefreshSubscription = undefined;
		}
	};
}

function reportSubscriberError(error: unknown) {
	if (typeof globalThis.reportError === 'function')
		globalThis.reportError(error);
	else console.error('Offline data status subscriber failed', error);
}

function publish(next: OfflinePublicDataState) {
	const { refreshError: _previousRefreshError, ...availability } = next;
	const refreshError = readPublicDataRefreshError();
	state = {
		...availability,
		// Starting a retry is not recovery. Keep a setup failure visible until
		// preparation verifies durable data or supplies a newer failure.
		...(next.phase === 'loading' && state.error && !next.error
			? { error: state.error }
			: {}),
		...(refreshError ? { refreshError } : {})
	};
	for (const listener of listeners) {
		try {
			listener(state);
		} catch (error) {
			reportSubscriberError(error);
		}
	}
	return state;
}

/** Automatically called on first open and reconnect. No private data is fetched here. */
export function prepareOfflinePublicData(
	onProgress?: (progress: DataLoadingProgress) => void
): Promise<OfflinePublicDataState> {
	if (!preparing) latestProgress = undefined;
	if (onProgress) {
		progressListeners.add(onProgress);
		if (latestProgress) {
			try {
				onProgress(latestProgress);
			} catch (error) {
				reportSubscriberError(error);
			}
		}
	}
	const observed = (pending: Promise<OfflinePublicDataState>) =>
		onProgress
			? pending.finally(() => progressListeners.delete(onProgress))
			: pending;
	if (preparing) return observed(preparing);
	preparing = (async () => {
		if (state.phase === 'ready') {
			const durable = await readPublicCourseDataReadiness();
			if (!durable.ready)
				publish({
					phase: 'loading',
					courseCount: durable.courseCount
				});
		} else
			publish({
				phase: 'loading',
				courseCount: state.courseCount
			});
		return preparePublicCourseData(undefined, publishProgress);
	})()
		.then((result) => {
			const { ready, courseCount } = result;
			const refreshError = readPublicDataRefreshError();
			return publish(
				ready
					? {
							phase: 'ready',
							courseCount
						}
					: {
							phase: 'error',
							courseCount,
							error:
								refreshError ??
								'Public course data could not be saved for offline use.'
						}
			);
		})
		.catch((error) =>
			publish({
				phase: 'error',
				courseCount: state.courseCount,
				error:
					error instanceof Error
						? error.message
						: 'Public course data could not be saved for offline use.'
			})
		)
		.finally(() => {
			preparing = undefined;
		});
	return observed(preparing);
}

/** Open a complete cached console immediately, then revalidate in the background. */
export async function bootstrapOfflinePublicData(
	onProgress?: (progress: DataLoadingProgress) => void
): Promise<OfflinePublicDataState> {
	const cached = await readPublicCourseDataReadiness();
	if (cached.ready) {
		const ready = publish({
			phase: 'ready',
			courseCount: cached.courseCount
		});
		void prepareOfflinePublicData();
		return ready;
	}
	return prepareOfflinePublicData(onProgress);
}
