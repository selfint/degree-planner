import { describe, expect, it } from 'vitest';
import { storybookPreviewLocation } from './storybookPreview.mjs';

describe('local Storybook entry routing', () => {
	it('preserves the exact story and toolbar query in the real redirect target', () => {
		expect(
			storybookPreviewLocation(
				'/storybook?path=/story/controls&globals=theme:dark'
			)
		).toBe('/storybook/index.html?path=/story/controls&globals=theme:dark');
	});

	it('supports a repository base without redirecting assets or other routes', () => {
		expect(
			storybookPreviewLocation('/degree-planner/storybook', '/degree-planner')
		).toBe('/degree-planner/storybook/index.html');
		for (const path of [
			'/',
			'/app/plan',
			'/storybook/',
			'/storybook/index.html',
			'/storybook/iframe.html',
			'/storybook/index.json'
		])
			expect(storybookPreviewLocation(path)).toBeNull();
	});
});
