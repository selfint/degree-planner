export type Theme = 'dark' | 'light';
export type ThemePreference = Theme | 'system';

export const themeStorageKey = 'theme';
export const systemThemeQuery = '(prefers-color-scheme: dark)';

export function parseThemePreference(
	value: string | null | undefined
): ThemePreference {
	return value === 'light' || value === 'system' ? value : 'dark';
}

export function parseTheme(value: string | null | undefined): Theme {
	return value === 'light' ? 'light' : 'dark';
}

export function resolveTheme(
	preference: ThemePreference,
	systemDark: boolean
): Theme {
	return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

export function applyTheme(preference: ThemePreference): void {
	document.documentElement.dataset.themePreference = preference;
	document.documentElement.dataset.theme = resolveTheme(
		preference,
		preference === 'system' && window.matchMedia(systemThemeQuery).matches
	);
}

export function saveTheme(preference: ThemePreference): void {
	applyTheme(preference);
	try {
		localStorage.setItem(themeStorageKey, preference);
	} catch {
		// Theme switching still works when storage is blocked or full.
	}
}

/** Follow OS changes only while System is selected; never overwrite the preference. */
export function watchSystemTheme(): () => void {
	const media = window.matchMedia(systemThemeQuery);
	const sync = () => {
		if (document.documentElement.dataset.themePreference === 'system') {
			document.documentElement.dataset.theme = resolveTheme(
				'system',
				media.matches
			);
		}
	};
	media.addEventListener('change', sync);
	sync();
	return () => media.removeEventListener('change', sync);
}
