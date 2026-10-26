import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
	consoleLoading,
	loadingText,
	reportConsoleLoading
} from './consoleLoading';

describe('measured loading progress', () => {
	it('publishes real counts and resets to an unmeasured stage', () => {
		reportConsoleLoading({
			phase: 'data',
			completed: 1,
			total: 2,
			pending: ['/courseData.json']
		});
		expect(get(consoleLoading)).toEqual({
			phase: 'data',
			completed: 1,
			total: 2,
			pending: ['/courseData.json']
		});
		expect(loadingText(get(consoleLoading), false)).toBe(
			'Loading courses… 1 of 2 data files complete'
		);
		reportConsoleLoading({ phase: 'finishing' });
		expect(get(consoleLoading)).toEqual({ phase: 'finishing' });
		reportConsoleLoading({ phase: 'checking' });
		expect(get(consoleLoading)).toEqual({ phase: 'checking' });
	});
	it('localizes each real stage and identifies whichever file remains', () => {
		expect(
			loadingText(
				{
					phase: 'data',
					completed: 0,
					total: 2,
					pending: ['/courseData.json', '/catalogs.json']
				},
				false
			)
		).toContain('courses and catalogs');
		expect(
			loadingText(
				{ phase: 'data', completed: 1, total: 2, pending: ['/catalogs.json'] },
				false
			)
		).toContain('Loading catalogs');
		expect(loadingText({ phase: 'checking' }, true)).toBe(
			'בודקים נתוני קורסים שמורים…'
		);
		expect(loadingText({ phase: 'error' }, true)).toContain('לא ניתן לפתוח');
	});
});
