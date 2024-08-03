import { describe, it, expect } from 'vitest';

import { getMedian } from './courseMedian';

describe('Course Median', () => {
	it('Gets the course median', async () => {
		const median = await getMedian('02340329');

		expect(median).toBeDefined();
		expect(median).toStrictEqual(99.6);
	});
});
