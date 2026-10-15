import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, parseTheme, saveTheme } from './theme';

const template = readFileSync('src/app.html', 'utf8');
const bootstrap = template.match(/<script>([\s\S]*?)<\/script>/)![1];

afterEach(() => vi.unstubAllGlobals());

describe('theme preference', () => {
	it.each([null, undefined, '', 'invalid', 'LIGHT', 'dark'])(
		'defaults %s to dark',
		(value) => {
			expect(parseTheme(value)).toBe('dark');
		}
	);

	it('recognizes light mode', () => {
		expect(parseTheme('light')).toBe('light');
	});

	it.each(['light', 'dark', 'invalid', null])(
		'restores %s before hydration',
		(value) => {
			const document = { documentElement: { dataset: { theme: 'dark' } } };
			runInNewContext(bootstrap, {
				document,
				localStorage: { getItem: () => value }
			});
			expect(document.documentElement.dataset.theme).toBe(parseTheme(value));
		}
	);

	it('keeps dark mode if initial storage access is blocked', () => {
		const document = { documentElement: { dataset: { theme: 'dark' } } };
		runInNewContext(bootstrap, {
			document,
			get localStorage() {
				throw new Error('Storage is blocked');
			}
		});
		expect(document.documentElement.dataset.theme).toBe('dark');
	});

	it('applies and persists the selected mode', () => {
		const document = { documentElement: { dataset: { theme: 'dark' } } };
		const setItem = vi.fn();
		vi.stubGlobal('document', document);
		vi.stubGlobal('localStorage', { setItem });
		saveTheme('light');
		expect(document.documentElement.dataset.theme).toBe('light');
		expect(setItem).toHaveBeenCalledWith('theme', 'light');
		applyTheme('dark');
		expect(document.documentElement.dataset.theme).toBe('dark');
	});

	it('still switches when saving the preference fails', () => {
		const document = { documentElement: { dataset: { theme: 'dark' } } };
		vi.stubGlobal('document', document);
		vi.stubGlobal('localStorage', {
			setItem: () => {
				throw new Error('Storage is full');
			}
		});
		expect(() => saveTheme('light')).not.toThrow();
		expect(document.documentElement.dataset.theme).toBe('light');
	});
});

describe('light palette contrast', () => {
	const css = readFileSync('src/app.css', 'utf8');
	const palette = css.match(/:root\[data-theme='light'\]\s*{([^}]+)}/)![1];
	const colors = Object.fromEntries(
		[...palette.matchAll(/--color-([\w-]+): ([\d ]+);/g)].map(
			([, name, rgb]) => [name, rgb.split(' ').map(Number)]
		)
	);
	function luminance(rgb: number[]) {
		const [r, g, b] = rgb.map((channel) => {
			const s = channel / 255;
			return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}
	it.each([
		['content-primary', 'background'],
		['content-secondary', 'background'],
		['content-primary', 'card-primary'],
		['content-secondary', 'card-primary'],
		['content-primary', 'card-secondary'],
		['content-secondary', 'card-secondary'],
		['accent-primary', 'background'],
		['accent-primary', 'card-primary'],
		['content-on-accent', 'accent-primary'],
		['link', 'background']
	])('%s on %s meets WCAG AA for normal text', (foreground, background) => {
		const values = [
			luminance(colors[foreground]),
			luminance(colors[background])
		].sort((a, b) => a - b);
		expect((values[1] + 0.05) / (values[0] + 0.05)).toBeGreaterThanOrEqual(4.5);
	});
});
