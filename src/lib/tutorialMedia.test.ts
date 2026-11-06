import { describe, expect, it } from 'vitest';
import { mediaGroups, mediaVariants, selectMediaTopics } from './tutorialMedia';

describe('recorded media registry', () => {
	it('preserves the published tutorial names and isolates unpublished feature work', () => {
		expect(selectMediaTopics()).toEqual(['course-card', 'plan-course']);
		expect(selectMediaTopics('features')).toEqual([
			'feature-search',
			'feature-plan',
			'feature-catalog',
			'feature-settings',
			'feature-course',
			'feature-semester',
			'feature-share'
		]);
		expect(selectMediaTopics('all').flatMap(mediaVariants)).toHaveLength(36);
		expect(() => selectMediaTopics('unknown')).toThrow(/Unknown media group/);
	});
	it('requires exactly four language/theme variants per topic', () => {
		expect(mediaVariants('feature-search').map(({ name }) => name)).toEqual([
			'feature-search-en-light',
			'feature-search-en-dark',
			'feature-search-he-light',
			'feature-search-he-dark'
		]);
		const topics = Object.values(mediaGroups).flat();
		expect(new Set(topics).size).toBe(topics.length);
	});
});
