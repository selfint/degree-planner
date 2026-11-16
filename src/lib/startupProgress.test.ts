import { expect, it } from 'vitest';
import { startupPercent } from './consoleLoading';
it('reserves the final fifth for completed work, never elapsed time', () => {
	const data = {
		phase: 'data' as const,
		completed: 0,
		total: 2,
		pending: [],
		activity: 'reading' as const,
		bytesRead: 50,
		totalBytes: 100
	};
	expect(startupPercent(data)).toBe(40);
	expect(startupPercent({ ...data, bytesRead: 100 })).toBe(80);
	expect(
		startupPercent({ ...data, activity: 'processing', bytesRead: 100 })
	).toBe(80);
	expect(startupPercent({ ...data, activity: 'saving', bytesRead: 100 })).toBe(
		85
	);
	expect(startupPercent({ ...data, completed: 2, activity: undefined })).toBe(
		90
	);
	expect(startupPercent({ phase: 'finishing' })).toBe(90);
	expect(startupPercent({ phase: 'finishing', accountReady: true })).toBe(95);
	expect(startupPercent({ phase: 'finishing', updateReady: true })).toBe(95);
	expect(
		startupPercent({ phase: 'ready', accountReady: true, updateReady: true })
	).toBe(100);
});
it('does not invent unknown download progress; completed stages and cached readiness count', () => {
	const data = {
		phase: 'data' as const,
		completed: 0,
		total: 2,
		pending: [],
		bytesRead: 100,
		activity: 'reading' as const
	};
	expect(startupPercent(data)).toBeUndefined();
	expect(startupPercent({ ...data, activity: 'processing' })).toBe(80);
	expect(startupPercent({ ...data, activity: 'saving' })).toBe(85);
	expect(startupPercent({ phase: 'checking' })).toBeUndefined();
	expect(startupPercent({ phase: 'finishing' })).toBe(90);
	expect(
		startupPercent({
			phase: 'finishing',
			accountReady: true,
			updateReady: true
		})
	).toBe(99);
});
