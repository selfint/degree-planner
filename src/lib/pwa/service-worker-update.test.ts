import { describe, expect, it } from 'vitest';
import { replacesExistingWorker } from './service-worker-update';

describe('service worker update notification', () => {
	it('does not announce the initial installation as an update', () => {
		expect(replacesExistingWorker({}, null, null)).toBe(false);
	});
	it('does not announce a first installation that already claimed the page', () => {
		const firstWorker = {};
		expect(replacesExistingWorker(firstWorker, firstWorker, firstWorker)).toBe(
			false
		);
	});
	it('recognizes an update of an active worker even before it controls the page', () => {
		expect(replacesExistingWorker({}, {}, null)).toBe(true);
	});
	it('recognizes an update of the worker controlling an open draft', () => {
		expect(replacesExistingWorker({}, null, {})).toBe(true);
	});
});
