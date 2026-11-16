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
		expect(loadingText(get(consoleLoading), false)).toBe('Downloading data…');
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
		).toContain('Downloading data');
		expect(
			loadingText(
				{ phase: 'data', completed: 1, total: 2, pending: ['/catalogs.json'] },
				false
			)
		).toContain('Downloading data');
		expect(loadingText({ phase: 'checking' }, true)).toBe(
			'בודקים נתונים שמורים…'
		);
		expect(loadingText({ phase: 'error' }, true)).toContain('לא ניתן לפתוח');
	});
});

it('keeps unknown totals indeterminate, including processing and saving', () => {
	for (const activity of ['reading', 'processing', 'saving'] as const) {
		const text = loadingText(
			{
				phase: 'data',
				completed: 1,
				total: 2,
				pending: ['/courseData.json'],
				bytesRead: 3924481,
				activity
			},
			false
		);
		expect(text).not.toContain('MB');
		expect(text).not.toContain('files complete');
		expect(text).not.toContain('%');
		if (activity === 'processing') expect(text).toContain('Processing');
		if (activity === 'saving') expect(text).toContain('Saving');
	}
});
