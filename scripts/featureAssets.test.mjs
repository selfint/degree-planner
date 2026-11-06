import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mediaVariants, selectMediaTopics } from '../src/lib/tutorialMedia';

const manifest = JSON.parse(
	readFileSync(
		new URL('../static/tutorials/manifest.json', import.meta.url),
		'utf8'
	)
);

describe('complete published landing media inventory', () => {
	it('publishes exactly all nine topics in all four language/theme variants', () => {
		const expected = selectMediaTopics('all')
			.flatMap(mediaVariants)
			.map(({ name }) => name)
			.sort();
		expect(expected).toHaveLength(36);
		expect(manifest.map(({ name }) => name).sort()).toEqual(expected);
	});
});
