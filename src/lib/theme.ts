export type Theme = 'dark' | 'light';

export const themeStorageKey = 'theme';

export function parseTheme(value: string | null | undefined): Theme {
	return value === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
	document.documentElement.dataset.theme = theme;
}

export function saveTheme(theme: Theme): void {
	applyTheme(theme);
	try {
		localStorage.setItem(themeStorageKey, theme);
	} catch {
		// Theme switching still works when storage is blocked or full.
	}
}
