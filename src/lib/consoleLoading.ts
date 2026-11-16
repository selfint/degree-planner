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
	const value = state.download ?? (state.phase === 'data' ? state : undefined);
	if (
		!value ||
		!value.totalBytes ||
		value.bytesRead === undefined ||
		value.bytesRead > value.totalBytes
	)
		return undefined;
	return { bytesRead: value.bytesRead, totalBytes: value.totalBytes };
}
/** Work after receiving data has no measurable byte progress of its own. */
export function loadingSettled(state: ConsoleLoadingState) {
	return (
		state.phase === 'finishing' ||
		state.phase === 'error' ||
		(state.phase === 'data' &&
			(state.activity === 'processing' || state.activity === 'saving'))
	);
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
		if (state.activity === 'processing')
			return hebrew ? 'מעבדים נתונים…' : 'Processing data…';
		if (state.activity === 'saving')
			return hebrew ? 'שומרים לשימוש לא מקוון…' : 'Saving offline…';
		const fraction = downloadFraction(state);
		const percent =
			fraction === undefined
				? ''
				: ` ${hebrew ? '\u2066' : ''}${Math.floor((state.bytesRead! * 100) / state.totalBytes!)}%${hebrew ? '\u2069' : ''}`;
		return `${hebrew ? 'מורידים נתונים…' : 'Downloading data…'}${percent}`;
	}
	const text = {
		opening: ['Loading application…', 'טוענים את היישום…'],
		checking: ['Checking saved data…', 'בודקים נתונים שמורים…'],
		finishing: ['Opening planner…', 'פותחים את המתכנן…'],
		error: ['Unable to load. Please reload.', 'לא ניתן לפתוח. טענו מחדש.']
	};
	return text[state.phase][hebrew ? 1 : 0];
}

/** Also updates the pre-hydration shell: route loads run before Svelte mounts. */
export function reportConsoleLoading(state: ConsoleLoadingState) {
	if (
		state.phase !== 'opening' &&
		state.phase !== 'checking' &&
		!downloadProgress(state)
	) {
		const download = downloadProgress(get(consoleLoading));
		if (download) state = { ...state, download };
	}
	consoleLoading.set(state);
	if (typeof document === 'undefined') return;
	const boot = document.getElementById('console-boot');
	if (!boot) return;
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
		'console-loading__track--settled',
		loadingSettled(state)
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
		track.setAttribute(
			'aria-valuenow',
			String(Math.floor((download!.bytesRead * 100) / download!.totalBytes))
		);
		indicator.style.inlineSize = `${fraction * 100}%`;
	} else indicator.style.removeProperty('inline-size');
}
