import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	coverage,
	exclusions,
	sourceComponents,
	root
} from '../../.storybook/coverage';

describe('exhaustive Storybook inventory', () => {
	it('accounts for every application Svelte component with no stale entries', () => {
		const covered = coverage.flatMap((entry) => [entry.path, ...entry.covers]);
		expect(
			coverage.every(
				(entry) => entry.path && entry.title && entry.stories.length > 0
			)
		).toBe(true);
		expect(
			[...new Set([...covered, ...Object.keys(exclusions)])].sort()
		).toEqual(sourceComponents);
		expect(new Set(coverage.map((entry) => entry.title)).size).toBe(
			coverage.length
		);
	});
	it('uses global theme, language and direction with the default viewport', () => {
		const config = readFileSync(join(root, '.storybook/preview.ts'), 'utf8');
		expect(config).not.toMatch(/viewport\s*:/);
		for (const entry of coverage) {
			expect(entry.source, entry.file).not.toMatch(
				/\bglobals\s*:|\bviewport\s*:/
			);
			expect(
				entry.stories.filter((story) =>
					/^(?:light|dark|mobile|hebrewrtl|rtl|ltr)$/i.test(story)
				),
				entry.file
			).toEqual([]);
		}
	});
	it('documents each covered component and each nonvisual exclusion', () => {
		const documentation = readFileSync(join(root, 'docs/storybook.md'), 'utf8');
		for (const component of sourceComponents)
			expect(documentation).toContain(component);
		for (const entry of coverage) {
			const row = documentation
				.split('\n')
				.find((line) => line.startsWith('|') && line.includes(entry.path!));
			expect(
				row?.split('|').map((cell) => cell.trim()),
				entry.file
			).toContain(entry.stories.join(', '));
		}
		expect(documentation).toContain(
			`${coverage.reduce((count, entry) => count + entry.stories.length, 0)} stories`
		);
	});
	it('keeps lifecycle and public-data services outside Storybook', () => {
		const config = readFileSync(join(root, '.storybook/main.ts'), 'utf8');
		expect(config).toContain('A live planner module entered Storybook');
		expect(config).toContain("from: '../static/brand'");
		expect(config).toContain("offlineData: 'offlineData.ts'");
		expect(config).toContain("'pwa/status': 'pwaStatus.ts'");
		for (const file of ['offlineData.ts', 'pwaStatus.ts']) {
			const mock = readFileSync(join(root, '.storybook/mocks', file), 'utf8');
			expect(mock).not.toMatch(/fetch\(|indexedDB|localStorage|serviceWorker/);
		}
		for (const entry of coverage) {
			expect(entry.source).not.toMatch(
				/(?:firebase|publicData|offlineData)\.svelte['"]|from ['"].*\+layout\.svelte['"]/
			);
		}
	});
});
