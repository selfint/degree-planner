/// <reference path="./types.d.ts"/>
import * as hist from './HistogramsClient.mjs';

import { suite, test } from 'vitest';

suite(
	'Histogram Client tests',
	{
		timeout: 60 * 1000
	},
	() => {
		test('Get course median', async (ctx) => {
			const code = 'SM02340114';
			const median = await hist.getMedian(code);
			ctx.expect(median).toBeDefined();
		});
	}
);
