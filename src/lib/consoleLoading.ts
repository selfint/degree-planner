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
	| { phase: 'opening' | 'checking' | 'finishing' | 'ready' | 'error' }
	| ({ phase: 'data' } & DataLoadingProgress)
) & {
	download?: DownloadProgress;
	accountReady?: boolean;
	updateReady?: boolean;
};

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
		state.phase === 'ready' ||
		state.phase === 'error' ||
		(state.phase === 'data' &&
			(state.activity === 'processing' || state.activity === 'saving'))
	);
}
export function downloadLabel(hebrew: boolean) {
	return hebrew ? 'התקדמות הטעינה' : 'Startup progress';
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

/** Weighted completed work, not a prediction of remaining time. */
export function startupPercent(state: ConsoleLoadingState): number | undefined {
	if (state.phase === 'ready') return 100;
	if (state.phase === 'finishing')
		return Math.min(
			99,
			90 + (state.accountReady ? 5 : 0) + (state.updateReady ? 5 : 0)
		);
	if (state.phase === 'data') {
		if (state.total > 0 && state.completed === state.total) return 90;
		// These aggregate stages start only after every pending stream/parser finishes.
		if (state.activity === 'saving') return 85;
		if (state.activity === 'processing') return 80;
	}
	const download = downloadProgress(state);
	return download
		? Math.floor((download.bytesRead * 80) / download.totalBytes)
		: undefined;
}

export function loadingText(
	state: ConsoleLoadingState,
	hebrew: boolean
): string {
	const percent = startupPercent(state);
	if (percent !== undefined && state.phase !== 'error') {
		const stage =
			state.phase === 'ready'
				? ['Ready', 'מוכן']
				: state.phase === 'finishing'
					? state.accountReady && !state.updateReady
						? ['Updates', 'עדכונים']
						: ['Opening', 'פתיחה']
					: state.phase === 'data' &&
						  state.total > 0 &&
						  state.completed === state.total
						? ['Checking', 'בדיקה']
						: state.phase === 'data' && state.activity === 'processing'
							? ['Processing', 'עיבוד']
							: state.phase === 'data' && state.activity === 'saving'
								? ['Saving', 'שמירה']
								: ['Downloading', 'הורדה'];
		return hebrew
			? `טעינה \u2066${percent}%\u2069 · ${stage[1]}`
			: `Startup ${percent}% · ${stage[0]}`;
	}
	const text = {
		opening: ['Loading application…', 'טוענים את היישום…'],
		checking: ['Checking saved data…', 'בודקים נתונים שמורים…'],
		data: ['Downloading data…', 'מורידים נתונים…'],
		finishing: ['Opening planner…', 'פותחים את המתכנן…'],
		ready: ['Ready', 'מוכן'],
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
	const percent = startupPercent(state);
	const fraction = percent === undefined ? undefined : percent / 100;
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
	track.setAttribute('aria-label', downloadLabel(boot.lang === 'he'));
	for (const attribute of ['aria-valuenow', 'aria-valuemax', 'aria-valuemin'])
		track.removeAttribute(attribute);
	if (fraction !== undefined) {
		track.setAttribute('aria-valuemin', '0');
		track.setAttribute('aria-valuemax', '100');
		track.setAttribute('aria-valuenow', String(percent));
		indicator.style.inlineSize = `${fraction * 100}%`;
	} else indicator.style.removeProperty('inline-size');
}
