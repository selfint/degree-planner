import { expect, it } from 'vitest';
import { downloadFraction, loadingText } from './consoleLoading';
it('measures only downloads with a known decoded total', () => {
	const state = {
		phase: 'data' as const,
		completed: 0,
		total: 2,
		pending: [],
		activity: 'reading' as const,
		bytesRead: 25,
		totalBytes: 100
	};
	expect(downloadFraction(state)).toBe(0.25);
	expect(
		loadingText(
			{ ...state, bytesRead: 1_000_000, totalBytes: 4_000_000 },
			false
		)
	).toContain('25%');
	expect(downloadFraction({ ...state, totalBytes: undefined })).toBeUndefined();
	expect(downloadFraction({ ...state, activity: 'saving' })).toBeUndefined();
	expect(
		downloadFraction({ ...state, activity: 'processing' })
	).toBeUndefined();
	expect(downloadFraction({ ...state, bytesRead: 101 })).toBeUndefined();
});
it('keeps the percentage ordered inside Hebrew status text', () => {
	expect(
		loadingText(
			{
				phase: 'data',
				completed: 0,
				total: 2,
				pending: [],
				activity: 'reading',
				bytesRead: 1_000_000,
				totalBytes: 4_000_000
			},
			true
		)
	).toContain('\u206625%\u2069');
});

it('never presents processing or account work as a download percentage', () => {
	const state = {
		phase: 'data' as const,
		completed: 1,
		total: 2,
		pending: [],
		bytesRead: 999,
		totalBytes: 1000
	};
	expect(loadingText({ ...state, activity: 'reading' }, false)).toContain(
		'99%'
	);
	expect(
		loadingText({ ...state, bytesRead: 290, activity: 'reading' }, false)
	).toContain('29%');
	for (const activity of ['processing', 'saving'] as const) {
		const text = loadingText({ ...state, bytesRead: 1000, activity }, false);
		expect(text).not.toContain('%');
		expect(text).not.toContain('MB');
	}
	expect(
		loadingText({ ...state, activity: 'reading', totalBytes: undefined }, false)
	).not.toMatch(/%|MB/);
	expect(
		loadingText(
			{ phase: 'finishing', download: { bytesRead: 1000, totalBytes: 1000 } },
			false
		)
	).not.toMatch(/%|MB/);
});
