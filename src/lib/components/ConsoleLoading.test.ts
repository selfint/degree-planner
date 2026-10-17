import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
	readFileSync(new URL(path, import.meta.url), 'utf8');
const shell = read('../../app.html');
const component = read('./ConsoleLoading.svelte');
const css = read('./console-loading.css');

describe('console loading presentation', () => {
	it('keeps pre-hydration styling identical to the reusable component styling', () => {
		const critical = shell.match(
			/<style id="console-loading-critical">([\s\S]*?)<\/style>/
		)?.[1];
		expect(critical).toBeDefined();
		expect(critical?.replace(/\s/g, '')).toBe(css.replace(/\s/g, ''));
	});

	it('uses the original PlanIt brand assets rather than a replacement', () => {
		for (const [source, published] of [
			['../assets/logo.webp', '../../../static/brand/planit-logo.webp'],
			['../assets/Title.svg', '../../../static/brand/planit-wordmark.svg']
		]) {
			expect(readFileSync(new URL(published, import.meta.url))).toEqual(
				readFileSync(new URL(source, import.meta.url))
			);
		}
	});

	it('exposes a real loading status without fabricated progress', () => {
		for (const markup of [shell, component]) {
			expect(markup).toContain('role="status"');
			expect(markup).not.toContain('aria-busy="true"');
			expect(markup).not.toContain('aria-valuenow');
		}
		expect(css).toContain('prefers-reduced-motion: reduce');
		expect(css).toMatch(/animation:\s*none/);
	});

	it('keeps the reusable loading view independent of application services', () => {
		expect(component).not.toMatch(
			/firebase|publicData|stores\.svelte|localStorage|serviceWorker/
		);
		const logo = shell.match(/<img\s+id="console-boot-logo"[\s\S]*?>/)?.[0];
		const wordmark = shell.match(
			/<img\s+id="console-boot-wordmark"[\s\S]*?>/
		)?.[0];
		expect(logo).toBeDefined();
		expect(wordmark).toBeDefined();
		// Static landing markup must not trigger console asset downloads.
		expect(logo).not.toMatch(/\bsrc=/);
		expect(wordmark).not.toMatch(/\bsrc=/);
	});
});
