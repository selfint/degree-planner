import { describe, it, expect } from 'vitest';

import { getName } from './courseName';

describe('Course Name', () => {
	it('Gets the course name', async () => {
		const name = await getName('234329');

		expect(name).toBeDefined();
		expect(name).toStrictEqual('234329 - פרויקט בעיבוד וניתוח תמונות');
	});
});
