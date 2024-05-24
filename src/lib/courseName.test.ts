import { describe, it, expect } from 'vitest';

import { JSDOM } from 'jsdom';
import { getName, type HTMLParser } from './courseName';

const NodeParser: HTMLParser = (html) => new JSDOM(html).window.document;

describe('Course Name', () => {
	it('Gets the course name', async () => {
		const name = await getName('234329', NodeParser);

		expect(name).toBeDefined();
		expect(name).toStrictEqual('234329 - פרויקט בעיבוד וניתוח תמונות');
	});
});
