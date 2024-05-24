import { describe, it, expect } from 'vitest';

import { parseCatalog } from './catalogParser';

describe('Catalog Parser', () => {
	it('removes duplicates', () => {
		const text = '123456 123456';
		const codes = ['123456'];

		expect(parseCatalog(text)).toStrictEqual(codes);
	});

	it('parses correctly', () => {
		const text = `'קנ
    236306 םיירקמ םיפרג 2.0
    236309 הניפצה תרותל אובמ 3.0
    236313 תויכוביסה תרות 3.0
    236315 בשחמה יעדמב תוירבגלא תוטיש 3.0
    236318 תוינאילוב תויצקנופ לש הזילנא 2.0
    236359 םימתירוגלא 2 3.0
    236374 םימתירוגלאו תויתורבתסה תוטיש 3.0
    236377 םיפרגב םירזובמ םימתירוגלא 3.0
    236378 לוהינ תונורקע תואדו רסח עדימ 2.0
    236508 תויכוביסו היפרגוטפירק 2.0
    236518 תרושקת תויכוביס 2.0
    236521 ק ימתירוגלא י בור 2.0
    236525`;
		const codes = [
			'236306',
			'236309',
			'236313',
			'236315',
			'236318',
			'236359',
			'236374',
			'236377',
			'236378',
			'236508',
			'236518',
			'236521',
			'236525'
		];
		expect(parseCatalog(text)).toStrictEqual(codes);
	});
});
