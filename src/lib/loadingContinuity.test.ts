import { expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
	consoleLoading,
	reportConsoleLoading,
	downloadProgress
} from './consoleLoading';
it('keeps the completed download visible through parsing, saving and account readiness, then resets on a new entry', () => {
	const data = {
		phase: 'data' as const,
		completed: 1,
		total: 2,
		pending: [],
		bytesRead: 100,
		totalBytes: 100
	};
	for (const activity of ['reading', 'processing', 'saving'] as const) {
		reportConsoleLoading({ ...data, activity });
		expect(downloadProgress(get(consoleLoading))).toEqual({
			bytesRead: 100,
			totalBytes: 100
		});
	}
	reportConsoleLoading({ phase: 'finishing' });
	expect(downloadProgress(get(consoleLoading))).toEqual({
		bytesRead: 100,
		totalBytes: 100
	});
	reportConsoleLoading({ phase: 'checking' });
	expect(downloadProgress(get(consoleLoading))).toBeUndefined();
});

it('never returns to bouncing when a later update lacks a reliable total', () => {
	reportConsoleLoading({ phase: 'checking' });
	reportConsoleLoading({
		phase: 'data',
		completed: 0,
		total: 2,
		pending: [],
		bytesRead: 52,
		totalBytes: 100,
		activity: 'reading'
	});
	for (const activity of ['reading', 'processing', 'saving'] as const) {
		reportConsoleLoading({
			phase: 'data',
			completed: 1,
			total: 2,
			pending: [],
			bytesRead: 60,
			activity
		});
		expect(downloadProgress(get(consoleLoading))).toEqual({
			bytesRead: 52,
			totalBytes: 100
		});
	}
	reportConsoleLoading({ phase: 'finishing' });
	expect(downloadProgress(get(consoleLoading))).toEqual({
		bytesRead: 52,
		totalBytes: 100
	});
	reportConsoleLoading({ phase: 'checking' });
	expect(downloadProgress(get(consoleLoading))).toBeUndefined();
});
