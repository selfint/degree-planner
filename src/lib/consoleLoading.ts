import { get, writable } from 'svelte/store';

export type DataLoadingProgress = {
	completed: number;
	total: number;
	pending: string[];
	bytesRead?: number;
	totalBytes?: number;
	activity?: 'reading' | 'processing' | 'saving';
};
type DownloadProgress = { bytesRead: number; totalBytes: number };
export type ConsoleLoadingState = (
	| { phase: 'opening' | 'checking' | 'finishing' | 'error' }
	| ({ phase: 'data' } & DataLoadingProgress)
) & { download?: DownloadProgress };

export const consoleLoading = writable<ConsoleLoadingState>({
	phase: 'opening'
});

/** This measures only the data read, including its completed state, not later work. */
export function downloadProgress(
	state: ConsoleLoadingState
): DownloadProgress | undefined {
	const value = state.phase === 'data' ? state : state.download;
	if (
		!value ||
		!value.totalBytes ||
		value.bytesRead === undefined ||
		value.bytesRead > value.totalBytes
	)
		return undefined;
	return { bytesRead: value.bytesRead, totalBytes: value.totalBytes };
}
export function downloadCompleteText(
	state: ConsoleLoadingState,
	hebrew: boolean
) {
	const download = downloadProgress(state);
	return download && download.bytesRead === download.totalBytes
		? hebrew
			? 'הורדת הנתונים הושלמה'
			: 'Data download complete'
		: '';
}
export function downloadLabel(hebrew: boolean) {
	return hebrew ? 'קריאת נתוני קורסים' : 'Course data download';
}

export function downloadFraction(
	state: ConsoleLoadingState
): number | undefined {
	if (
		state.phase !== 'data' ||
		state.activity !== 'reading' ||
		!state.totalBytes ||
		state.bytesRead === undefined ||
		state.bytesRead > state.totalBytes
	)
		return undefined;
	return state.bytesRead / state.totalBytes;
}

export function loadingText(
	state: ConsoleLoadingState,
	hebrew: boolean
): string {
	if (state.phase === 'data') {
		const courses = state.pending.includes('/courseData.json');
		const catalogs = state.pending.includes('/catalogs.json');
		let stage =
			courses && catalogs
				? hebrew
					? 'טוענים קורסים וקטלוגים…'
					: 'Loading courses and catalogs…'
				: courses
					? hebrew
						? 'טוענים קורסים…'
						: 'Loading courses…'
					: catalogs
						? hebrew
							? 'טוענים קטלוגים…'
							: 'Loading catalogs…'
						: state.pending.length
							? hebrew
								? 'טוענים דרישות תואר…'
								: 'Loading degree requirements…'
							: hebrew
								? 'בודקים את הנתונים…'
								: 'Checking loaded data…';
		if (state.activity === 'processing')
			stage = hebrew ? 'מעבדים את הנתונים…' : 'Processing data…';
		if (state.activity === 'saving')
			stage = hebrew
				? 'שומרים נתונים לשימוש ללא אינטרנט…'
				: 'Saving data for offline use…';
		const bytes = state.bytesRead
			? ` ${hebrew ? '\u2066' : ''}${(state.bytesRead / 1_000_000).toFixed(1)}${downloadFraction(state) !== undefined ? ` / ${(state.totalBytes! / 1_000_000).toFixed(1)}` : ''} MB${hebrew ? '\u2069' : ''} ${hebrew ? 'נקראו.' : 'read.'}`
			: '';
		return `${stage}${bytes} ${hebrew ? `קובצי נתונים שהושלמו: ${state.completed} מתוך ${state.total}` : `${state.completed} of ${state.total} data files complete`}`;
	}
	const text = {
		opening: ['Loading application…', 'טוענים את היישום…'],
		checking: ['Checking saved course data…', 'בודקים נתוני קורסים שמורים…'],
		finishing: ['Opening your planner…', 'פותחים את מתכנן הלימודים…'],
		error: [
			'Unable to open PlanIt. Please reload to try again.',
			'לא ניתן לפתוח את PlanIt. נסו לטעון את הדף מחדש.'
		]
	};
	return text[state.phase][hebrew ? 1 : 0];
}

/** Also updates the pre-hydration shell: route loads run before Svelte mounts. */
export function reportConsoleLoading(state: ConsoleLoadingState) {
	if (state.phase === 'finishing') {
		const download = downloadProgress(get(consoleLoading));
		if (download) state = { ...state, download };
	}
	consoleLoading.set(state);
	if (typeof document === 'undefined') return;
	const boot = document.getElementById('console-boot');
	if (!boot) return;
	const caption = boot.querySelector('.console-loading__download');
	if (caption)
		caption.textContent = downloadCompleteText(state, boot.lang === 'he');
	const status = boot.querySelector('.console-loading__status');
	if (status) status.textContent = loadingText(state, boot.lang === 'he');
	const track = boot.querySelector<HTMLElement>('.console-loading__track');
	const indicator = boot.querySelector<HTMLElement>(
		'.console-loading__indicator'
	);
	if (!track || !indicator) return;
	const download = downloadProgress(state);
	const fraction = download
		? download.bytesRead / download.totalBytes
		: undefined;
	track.classList.toggle(
		'console-loading__track--measured',
		fraction !== undefined
	);
	track.classList.toggle(
		'console-loading__track--error',
		state.phase === 'error'
	);
	track.removeAttribute('aria-hidden');
	if (state.phase === 'error') {
		track.removeAttribute('role');
		track.setAttribute('aria-hidden', 'true');
	} else track.setAttribute('role', 'progressbar');
	track.setAttribute(
		'aria-label',
		download
			? downloadLabel(boot.lang === 'he')
			: loadingText(state, boot.lang === 'he')
	);
	for (const attribute of ['aria-valuenow', 'aria-valuemax', 'aria-valuemin'])
		track.removeAttribute(attribute);
	if (fraction !== undefined) {
		track.setAttribute('aria-valuemin', '0');
		track.setAttribute('aria-valuemax', '100');
		track.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
		indicator.style.inlineSize = `${fraction * 100}%`;
	} else indicator.style.removeProperty('inline-size');
}
