export type Theme = 'dark' | 'light';
export const themeStorageKey = 'storybook-theme';
export const parseTheme = (value: string | null | undefined): Theme =>
	value === 'light' ? 'light' : 'dark';
export const applyTheme = (theme: Theme) => {
	document.documentElement.dataset.theme = theme;
};
export const saveTheme = applyTheme;
