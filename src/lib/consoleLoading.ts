import { writable } from 'svelte/store';

export type DataLoadingProgress = {
	completed: number;
	total: number;
	pending: string[];
	bytesRead?: number;
	activity?: 'reading' | 'processing' | 'saving';
};
export type ConsoleLoadingState =
	| { phase: 'opening' | 'checking' | 'finishing' | 'error' }
	| ({ phase: 'data' } & DataLoadingProgress);

export const consoleLoading = writable<ConsoleLoadingState>({
	phase: 'opening'
});

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
			? ` ${(state.bytesRead / 1_000_000).toFixed(1)} MB ${hebrew ? 'נקראו.' : 'read.'}`
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
	track.classList.remove('console-loading__track--measured');
	track.classList.toggle(
		'console-loading__track--error',
		state.phase === 'error'
	);
	track.removeAttribute('aria-hidden');
	if (state.phase === 'error') {
		track.removeAttribute('role');
		track.setAttribute('aria-hidden', 'true');
	} else track.setAttribute('role', 'progressbar');
	track.setAttribute('aria-label', loadingText(state, boot.lang === 'he'));
	for (const attribute of ['aria-valuenow', 'aria-valuemax', 'aria-valuemin'])
		track.removeAttribute(attribute);
	indicator.style.removeProperty('inline-size');
}
