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
	).toContain('1.0 / 4.0 MB read.');
	expect(downloadFraction({ ...state, totalBytes: undefined })).toBeUndefined();
	expect(downloadFraction({ ...state, activity: 'saving' })).toBeUndefined();
	expect(
		downloadFraction({ ...state, activity: 'processing' })
	).toBeUndefined();
	expect(downloadFraction({ ...state, bytesRead: 101 })).toBeUndefined();
});
it('keeps read / total ordered left-to-right inside Hebrew status text', () => {
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
	).toContain('\u20661.0 / 4.0 MB\u2069');
});
