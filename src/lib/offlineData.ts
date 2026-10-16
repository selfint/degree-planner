import { preparePublicCourseData } from './publicData';

export type OfflinePublicDataState = {
	phase: 'idle' | 'loading' | 'ready' | 'error';
	courseCount: number;
	error?: string;
};

let state: OfflinePublicDataState = { phase: 'idle', courseCount: 0 };
const listeners = new Set<(state: OfflinePublicDataState) => void>();
let preparing: Promise<OfflinePublicDataState> | undefined;

export function subscribeOfflinePublicData(
	callback: (state: OfflinePublicDataState) => void
) {
	listeners.add(callback);
	callback(state);
	return () => {
		listeners.delete(callback);
	};
}

function publish(next: OfflinePublicDataState) {
	state = next;
	for (const listener of listeners) listener(state);
	return state;
}

/** Automatically called on first open and reconnect. No private data is fetched here. */
export function prepareOfflinePublicData(): Promise<OfflinePublicDataState> {
	if (preparing) return preparing;
	publish({ phase: 'loading', courseCount: state.courseCount });
	preparing = preparePublicCourseData()
		.then(({ ready, courseCount }) =>
			publish(
				ready
					? { phase: 'ready', courseCount }
					: {
							phase: 'error',
							courseCount,
							error: 'Public course data could not be saved for offline use.'
						}
			)
		)
		.catch(() =>
			publish({
				phase: 'error',
				courseCount: state.courseCount,
				error: 'Public course data could not be saved for offline use.'
			})
		)
		.finally(() => {
			preparing = undefined;
		});
	return preparing;
}
