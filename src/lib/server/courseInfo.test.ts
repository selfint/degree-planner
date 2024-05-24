import { describe, it, expect } from 'vitest';

import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { getName } from './courseInfo';

describe('Course Name', () => {
	it('Gets the course name', async () => {
		const HTML = readFileSync(resolve(__dirname, 'course_234218.html'), 'utf-8');

		const name = await getName('234218', new JSDOM(HTML).window.document);

		expect(name).toBeDefined();
		expect(name).toStrictEqual('234218 - מבני נתונים 1');
	});
});
